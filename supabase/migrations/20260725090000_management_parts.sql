-- 관리파트(management_parts) 도입 — 관리번호 prefix를 사업장(org_code)에서 분리한다.
-- 한 사업장에서 소화기를 관리하는 조직이 여러 개(예: 무안공항의 공사/소방)로 늘 수 있으므로,
-- 관리번호 앞자리를 사업장 하위의 "관리파트"로 옮긴다. 관리번호는 {파트코드}-{건물}-{층}-{번호}.
-- 건물/층은 파트 공용이고, 파트가 다르면 소화기 번호는 1부터 독립 채번된다.
--
-- 1단계(이 파일): 파트 개념 + 관리번호 체계만. 권한 모델(user_parts 등)은 별도 마이그레이션.
-- 기존 소화기는 각 사업장의 org_code를 "기본 파트"로 전환 → 관리번호(=부착 QR) 불변.

-- 1) 관리파트 테이블 --------------------------------------------------------
create table public.management_parts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  -- 관리번호(asset_code)의 앞자리로 쓰이는 코드. 전체에서 유일(관리번호 충돌 방지).
  code text not null unique,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_management_parts_site on public.management_parts (site_id);

alter table public.management_parts enable row level security;

-- 읽기: 배정된 사업장의 파트만(구조 조회). 쓰기: 시스템관리자만(사업장과 동일 취급).
create policy "management_parts_read" on public.management_parts
  for select using (public.has_site_access(site_id));
create policy "management_parts_super_admin_write" on public.management_parts
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- 2) 기본 파트 seed: 각 사업장의 현재 org_code를 파트로 전환 --------------------
insert into public.management_parts (site_id, code, name, order_index)
select s.id, s.org_code, s.org_code, 0
from public.sites s
where s.org_code is not null;

-- 3) extinguishers.part_id 추가 + 기존 소화기를 기본 파트로 backfill -----------
-- (이 시점의 트리거는 part_id를 감시하지 않으므로 backfill UPDATE는 asset_code를 바꾸지 않는다.)
-- part_id는 nullable로 둔다: 프리뷰/운영이 같은 DB를 공유하므로, 아직 배포되지 않은 구버전
-- 코드가 part_id 없이 소화기를 등록해도 트리거가 기본 파트로 채워 깨지지 않게 한다(전환 안전).
alter table public.extinguishers
  add column part_id uuid references public.management_parts (id) on delete restrict;

update public.extinguishers e
set part_id = (
  select mp.id from public.management_parts mp
  where mp.site_id = public.fn_extinguisher_site_id(e.id)
  order by mp.order_index, mp.created_at
  limit 1
);

create index idx_extinguishers_part on public.extinguishers (part_id);

-- 4) 관리번호 생성 트리거 재작성: org_code → 파트 코드, 채번 스코프에 part_id 포함 ---
create or replace function public.fn_set_extinguisher_asset_code()
returns trigger
language plpgsql
as $$
declare
  v_part_code text;
  v_part_site uuid;
  v_building_no int;
  v_building_id uuid;
  v_floor_code text;
  v_loc_site uuid;
  v_scope_key text;
begin
  -- part_id가 비어 있으면(구버전 코드 등록) 설치 위치가 속한 사업장의 기본 파트로 채운다.
  if new.part_id is null then
    select mp.id into new.part_id
    from public.management_parts mp
    where mp.site_id = coalesce(
      (select b.site_id from public.floors f
         join public.buildings b on b.id = f.building_id where f.id = new.floor_id),
      (select b.site_id from public.vehicles v
         join public.buildings b on b.id = v.building_id where v.id = new.vehicle_id)
    )
    order by mp.order_index, mp.created_at
    limit 1;

    if new.part_id is null then
      raise exception '설치 위치의 사업장에 관리파트가 없습니다. 사업장 관리에서 파트를 먼저 추가하세요';
    end if;
  end if;

  -- 파트 코드/소속 사업장 조회
  select mp.code, mp.site_id into v_part_code, v_part_site
  from public.management_parts mp
  where mp.id = new.part_id;

  if v_part_code is null then
    raise exception 'part_id(%)에 해당하는 관리파트를 찾을 수 없습니다', new.part_id;
  end if;

  if new.location_type = 'BUILDING' then
    select b.building_no, f.floor_code, b.site_id
      into v_building_no, v_floor_code, v_loc_site
    from public.floors f
    join public.buildings b on b.id = f.building_id
    where f.id = new.floor_id;

    if v_building_no is null then
      raise exception 'floor_id(%)에 해당하는 건물/층을 찾을 수 없습니다', new.floor_id;
    end if;
    if v_part_site <> v_loc_site then
      raise exception '관리파트(%)와 설치 위치의 사업장이 다릅니다', new.part_id;
    end if;

    -- 파트별로 층 스코프에서 1부터 채번
    v_scope_key := 'floor:' || new.floor_id::text || ':part:' || new.part_id::text;
    if new.extinguisher_no is null then
      perform pg_advisory_xact_lock(hashtext(v_scope_key));
      select coalesce(max(extinguisher_no), 0) + 1 into new.extinguisher_no
      from public.extinguishers
      where floor_id = new.floor_id and part_id = new.part_id and location_type = 'BUILDING';
    end if;

    new.asset_code := v_part_code || '-' || v_building_no || '-' || v_floor_code || '-' || new.extinguisher_no;
  else
    select b.building_no, b.id, b.site_id
      into v_building_no, v_building_id, v_loc_site
    from public.vehicles v
    join public.buildings b on b.id = v.building_id
    where v.id = new.vehicle_id;

    if v_building_no is null then
      raise exception 'vehicle_id(%)에 해당하는 건물/차량을 찾을 수 없습니다', new.vehicle_id;
    end if;
    if v_part_site <> v_loc_site then
      raise exception '관리파트(%)와 차량의 사업장이 다릅니다', new.part_id;
    end if;

    -- 차량 소화기는 파트별로 "건물" 단위에서 채번(같은 건물의 모든 차량에 걸쳐 연속)
    v_scope_key := 'bvh:' || v_building_id::text || ':part:' || new.part_id::text;
    if new.extinguisher_no is null then
      perform pg_advisory_xact_lock(hashtext(v_scope_key));
      select coalesce(max(e.extinguisher_no), 0) + 1 into new.extinguisher_no
      from public.extinguishers e
      where e.location_type = 'VEHICLE'
        and e.part_id = new.part_id
        and e.vehicle_id in (select v2.id from public.vehicles v2 where v2.building_id = v_building_id);
    end if;

    new.asset_code := v_part_code || '-' || v_building_no || '-차-' || new.extinguisher_no;
  end if;

  return new;
end;
$$;

-- 트리거 재생성: part_id 변경도 감시(파트 이동 시 관리번호 재계산)
drop trigger if exists trg_set_extinguisher_asset_code on public.extinguishers;
create trigger trg_set_extinguisher_asset_code
  before insert or update of location_type, floor_id, vehicle_id, extinguisher_no, part_id
  on public.extinguishers
  for each row execute function public.fn_set_extinguisher_asset_code();

-- 5) 캐스케이드: 파트 코드 변경 시 소속 소화기 관리번호 재계산 --------------------
-- (org_code는 더 이상 asset_code에 쓰이지 않으므로 site 캐스케이드는 제거)
drop trigger if exists trg_cascade_asset_code_site on public.sites;
drop function if exists public.fn_cascade_asset_code_from_site();

create or replace function public.fn_cascade_asset_code_from_part()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.code is distinct from old.code then
    -- extinguisher_no를 제자리 갱신(touch)하면 BEFORE 트리거가 asset_code를 재조합한다.
    update public.extinguishers e set extinguisher_no = e.extinguisher_no
    where e.part_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_cascade_asset_code_part
  after update of code on public.management_parts
  for each row execute function public.fn_cascade_asset_code_from_part();

-- 6) 사업장 코드 제약 완화: 이후 사업장은 코드 없이 추가(관리번호는 파트가 담당) ------
alter table public.sites alter column org_code drop not null;

-- 7) 뷰에 파트 정보 노출 (CREATE OR REPLACE: 기존 컬럼 순서/타입 유지, 끝에만 추가) ----
create or replace view public.v_extinguisher_overview
with (security_invoker = true) as
select
  e.id,
  e.asset_code,
  e.location_type,
  e.extinguisher_no,
  e.status,
  e.manufacture_date,
  e.useful_life_years,
  e.capacity,
  e.install_note,
  (e.manufacture_date + (e.useful_life_years || ' years')::interval)::date as replace_due_date,
  public.fn_extinguisher_status(e.manufacture_date, e.useful_life_years) as lifecycle_status,
  et.id as extinguisher_type_id,
  et.name as extinguisher_type_name,
  s.id as site_id,
  s.name as site_name,
  s.org_code as org_code,
  b.id as building_id,
  b.name as building_name,
  b.building_no as building_no,
  f.id as floor_id,
  f.name as floor_name,
  f.floor_code as floor_code,
  z.id as zone_id,
  z.name as zone_name,
  veh.id as vehicle_id,
  veh.name as vehicle_name,
  veh.vehicle_no as vehicle_no,
  veh.plate_no as vehicle_plate_no,
  li.inspected_at as last_inspected_at,
  li.overall_result as last_inspection_result,
  li.inspector_id as last_inspector_id,
  exists (
    select 1 from public.inspections i2
    where i2.extinguisher_id = e.id
      and (i2.inspected_at at time zone 'Asia/Seoul')::date = public.fn_kst_today()
  ) as inspected_today,
  exists (
    select 1 from public.inspections i3
    where i3.extinguisher_id = e.id
      and date_trunc('month', i3.inspected_at at time zone 'Asia/Seoul')
        = date_trunc('month', now() at time zone 'Asia/Seoul')
  ) as inspected_this_month,
  veh.department as vehicle_department,
  e.serial_no as serial_no,
  li.memo as last_inspection_memo,
  li.pressure_ok as last_pressure_ok,
  li.seal_ok as last_seal_ok,
  li.appearance_ok as last_appearance_ok,
  li.installation_ok as last_installation_ok,
  li.id as last_inspection_id,
  la.action_note as last_action_note,
  la.resolved_at as last_action_resolved_at,
  li.etc_ok as last_etc_ok,
  mp.id as part_id,
  mp.code as part_code,
  mp.name as part_name
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
join public.management_parts mp on mp.id = e.part_id
left join public.floors f on f.id = e.floor_id
left join public.vehicles veh on veh.id = e.vehicle_id
left join public.buildings b on b.id = coalesce(f.building_id, veh.building_id)
left join public.sites s on s.id = b.site_id
left join public.zones z on z.id = e.zone_id
left join lateral (
  select id, inspected_at, overall_result, inspector_id, memo,
         pressure_ok, seal_ok, appearance_ok, installation_ok, etc_ok
  from public.inspections i
  where i.extinguisher_id = e.id
  order by i.inspected_at desc
  limit 1
) li on true
left join lateral (
  select action_note, resolved_at
  from public.inspection_actions a
  where a.inspection_id = li.id
  limit 1
) la on true;

-- 경량 목록 뷰에도 파트 정보 추가
create or replace view public.v_extinguisher_list
with (security_invoker = true) as
select
  e.id,
  e.asset_code,
  e.location_type,
  e.extinguisher_no,
  e.status,
  e.manufacture_date,
  e.useful_life_years,
  e.capacity,
  e.install_note,
  (e.manufacture_date + (e.useful_life_years || ' years')::interval)::date as replace_due_date,
  public.fn_extinguisher_status(e.manufacture_date, e.useful_life_years) as lifecycle_status,
  et.id as extinguisher_type_id,
  et.name as extinguisher_type_name,
  s.id as site_id,
  s.name as site_name,
  s.org_code as org_code,
  b.id as building_id,
  b.name as building_name,
  b.building_no as building_no,
  f.id as floor_id,
  f.name as floor_name,
  f.floor_code as floor_code,
  z.id as zone_id,
  z.name as zone_name,
  veh.id as vehicle_id,
  veh.name as vehicle_name,
  veh.vehicle_no as vehicle_no,
  veh.plate_no as vehicle_plate_no,
  li.inspected_at as last_inspected_at,
  li.overall_result as last_inspection_result,
  li.inspector_id as last_inspector_id,
  veh.department as vehicle_department,
  e.serial_no as serial_no,
  mp.id as part_id,
  mp.code as part_code,
  mp.name as part_name
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
join public.management_parts mp on mp.id = e.part_id
left join public.floors f on f.id = e.floor_id
left join public.vehicles veh on veh.id = e.vehicle_id
left join public.buildings b on b.id = coalesce(f.building_id, veh.building_id)
left join public.sites s on s.id = b.site_id
left join public.zones z on z.id = e.zone_id
left join lateral (
  select inspected_at, overall_result, inspector_id
  from public.inspections i
  where i.extinguisher_id = e.id
  order by i.inspected_at desc
  limit 1
) li on true;

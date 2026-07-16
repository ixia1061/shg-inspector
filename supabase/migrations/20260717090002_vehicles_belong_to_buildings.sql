-- 차량을 사업장 직속에서 "건물 소속"으로 변경하고 번호판(plate_no)을 추가한다.
-- 관리번호 형식 변경: {org}-차-{차량번호}-{n}  →  {org}-{건물번호}-차-{n}
--   * n은 건물 단위로 채번 (같은 건물의 차량 소화기 전체에서 일련번호)
--   * 차량 소화기도 건물 수량에 포함되어 집계된다

-- 0) 기존 뷰가 vehicles.site_id를 참조하므로 컬럼 변경 전에 먼저 제거 (아래 5에서 재생성)
drop view public.v_extinguisher_overview;

-- 1) vehicles 스키마 변경 --------------------------------------------------
alter table public.vehicles add column building_id uuid references public.buildings (id) on delete cascade;
alter table public.vehicles add column plate_no text;

-- 기존 차량은 해당 사업장의 가장 낮은 번호 건물로 배정
update public.vehicles v
set building_id = (
  select b.id from public.buildings b
  where b.site_id = v.site_id
  order by b.building_no
  limit 1
);

alter table public.vehicles alter column building_id set not null;

-- site_id에 의존하는 정책/제약을 먼저 제거한 뒤 컬럼 삭제
drop policy "vehicles_inspector_read" on public.vehicles;
alter table public.vehicles drop constraint vehicles_site_id_vehicle_no_key;
alter table public.vehicles drop column site_id;

alter table public.vehicles add constraint vehicles_building_id_vehicle_no_key unique (building_id, vehicle_no);
create index idx_vehicles_building on public.vehicles (building_id);

create policy "vehicles_inspector_read" on public.vehicles
  for select using (
    public.has_site_access((select b.site_id from public.buildings b where b.id = building_id))
  );

-- 층 코드 '차'는 차량 관리번호(org-건물-차-n)와 충돌하므로 금지
alter table public.floors add constraint chk_floor_code_not_vehicle check (floor_code <> '차');

-- 2) asset_code 생성 트리거 재작성 ------------------------------------------
create or replace function public.fn_set_extinguisher_asset_code()
returns trigger
language plpgsql
as $$
declare
  v_org_code text;
  v_building_no int;
  v_building_id uuid;
  v_floor_code text;
  v_scope_key text;
begin
  if new.location_type = 'BUILDING' then
    select s.org_code, b.building_no, f.floor_code
      into v_org_code, v_building_no, v_floor_code
    from public.floors f
    join public.buildings b on b.id = f.building_id
    join public.sites s on s.id = b.site_id
    where f.id = new.floor_id;

    if v_org_code is null then
      raise exception 'floor_id(%)에 해당하는 사업장/건물/층을 찾을 수 없습니다', new.floor_id;
    end if;

    v_scope_key := 'floor:' || new.floor_id::text;

    if new.extinguisher_no is null then
      perform pg_advisory_xact_lock(hashtext(v_scope_key));
      select coalesce(max(extinguisher_no), 0) + 1 into new.extinguisher_no
      from public.extinguishers
      where floor_id = new.floor_id and location_type = 'BUILDING';
    end if;

    new.asset_code := v_org_code || '-' || v_building_no || '-' || v_floor_code || '-' || new.extinguisher_no;
  else
    select s.org_code, b.building_no, b.id
      into v_org_code, v_building_no, v_building_id
    from public.vehicles v
    join public.buildings b on b.id = v.building_id
    join public.sites s on s.id = b.site_id
    where v.id = new.vehicle_id;

    if v_org_code is null then
      raise exception 'vehicle_id(%)에 해당하는 사업장/건물/차량을 찾을 수 없습니다', new.vehicle_id;
    end if;

    -- 차량 소화기는 "건물" 단위로 일련번호를 매긴다 (같은 건물의 모든 차량에 걸쳐 연속)
    v_scope_key := 'bvh:' || v_building_id::text;

    if new.extinguisher_no is null then
      perform pg_advisory_xact_lock(hashtext(v_scope_key));
      select coalesce(max(e.extinguisher_no), 0) + 1 into new.extinguisher_no
      from public.extinguishers e
      where e.location_type = 'VEHICLE'
        and e.vehicle_id in (select v2.id from public.vehicles v2 where v2.building_id = v_building_id);
    end if;

    new.asset_code := v_org_code || '-' || v_building_no || '-차-' || new.extinguisher_no;
  end if;

  return new;
end;
$$;

-- 3) 캐스케이드 트리거 갱신 --------------------------------------------------
-- 차량번호는 더 이상 관리번호에 포함되지 않으므로 차량 캐스케이드는 제거
drop trigger if exists trg_cascade_asset_code_vehicle on public.vehicles;
drop function if exists public.fn_cascade_asset_code_from_vehicle();

create or replace function public.fn_cascade_asset_code_from_site()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.org_code is distinct from old.org_code then
    update public.extinguishers e set extinguisher_no = e.extinguisher_no
    where e.floor_id in (
      select f.id from public.floors f
      join public.buildings b on b.id = f.building_id
      where b.site_id = new.id
    )
    or e.vehicle_id in (
      select v.id from public.vehicles v
      join public.buildings b on b.id = v.building_id
      where b.site_id = new.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.fn_cascade_asset_code_from_building()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.building_no is distinct from old.building_no then
    update public.extinguishers e set extinguisher_no = e.extinguisher_no
    where e.floor_id in (select f.id from public.floors f where f.building_id = new.id)
       or e.vehicle_id in (select v.id from public.vehicles v where v.building_id = new.id);
  end if;
  return new;
end;
$$;

-- 4) RLS 헬퍼 갱신 (차량 → 건물 → 사업장 경로) -------------------------------
create or replace function public.fn_extinguisher_site_id(p_extinguisher_id uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select coalesce(
    (
      select b.site_id from public.extinguishers e
      join public.floors f on f.id = e.floor_id
      join public.buildings b on b.id = f.building_id
      where e.id = p_extinguisher_id
    ),
    (
      select b.site_id from public.extinguishers e
      join public.vehicles v on v.id = e.vehicle_id
      join public.buildings b on b.id = v.building_id
      where e.id = p_extinguisher_id
    )
  );
$$;

-- 5) 뷰 재작성: 차량 소화기도 건물/사업장 정보를 갖는다 -----------------------
create view public.v_extinguisher_overview
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
  ) as inspected_this_month
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
left join public.floors f on f.id = e.floor_id
left join public.vehicles veh on veh.id = e.vehicle_id
-- 건물/사업장은 층 경로든 차량 경로든 항상 채워진다
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

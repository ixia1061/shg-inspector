-- 소화기 자산 테이블
-- 관리번호(asset_code)는 "관리기관-건물번호-층코드-소화기번호" (건물) 또는
-- "관리기관-차-차량번호-소화기번호" (차량) 형식으로 시스템이 자동 생성한다 (아래 트리거 참고).
create table public.extinguishers (
  id uuid primary key default gen_random_uuid(),
  location_type text not null check (location_type in ('BUILDING', 'VEHICLE')),
  floor_id uuid references public.floors (id) on delete restrict,
  zone_id uuid references public.zones (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete restrict,
  -- 위치 스코프(건물의 층, 또는 차량) 내에서 자동 채번되는 일련번호. 이동해도 값은 유지된다.
  extinguisher_no int not null,
  -- 자동 생성되는 사람이 읽는 관리번호. UNIQUE. 위치가 바뀌면 트리거가 재계산한다.
  asset_code text not null unique,
  extinguisher_type_id uuid not null references public.extinguisher_types (id) on delete restrict,
  manufacture_date date not null,
  useful_life_years int not null,
  capacity text,
  install_note text,
  status text not null default 'active' check (status in ('active', 'replaced', 'disposed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_extinguisher_location check (
    (location_type = 'BUILDING' and floor_id is not null and vehicle_id is null)
    or
    (location_type = 'VEHICLE' and vehicle_id is not null and floor_id is null and zone_id is null)
  )
);
create index idx_extinguishers_floor on public.extinguishers (floor_id);
create index idx_extinguishers_zone on public.extinguishers (zone_id);
create index idx_extinguishers_vehicle on public.extinguishers (vehicle_id);
create index idx_extinguishers_asset_code on public.extinguishers (asset_code);

-- 관리번호 변경 이력. extinguishers.id(UUID)는 절대 바뀌지 않으므로 점검 이력은 항상 안전하게
-- 유지되지만, 이미 출력된 QR 라벨이 과거 관리번호를 담고 있을 수 있으므로 이 테이블로 과거
-- 관리번호 -> 현재 소화기를 역으로 찾을 수 있게 한다.
create table public.asset_code_history (
  id uuid primary key default gen_random_uuid(),
  extinguisher_id uuid not null references public.extinguishers (id) on delete cascade,
  asset_code text not null,
  changed_at timestamptz not null default now()
);
create index idx_asset_code_history_code on public.asset_code_history (asset_code);
create index idx_asset_code_history_extinguisher on public.asset_code_history (extinguisher_id);

-- extinguisher_no 자동 채번 + asset_code 조합
-- extinguisher_no는 최초 생성 시 한 번만 자동 할당되고 이후에는 유지된다(위치 이동으로 인한
-- 재채번 없음). asset_code는 위치/번호가 바뀔 때마다 항상 최신 상태로 재계산된다.
create or replace function public.fn_set_extinguisher_asset_code()
returns trigger
language plpgsql
as $$
declare
  v_org_code text;
  v_building_no int;
  v_floor_code text;
  v_vehicle_no int;
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
    select s.org_code, v.vehicle_no
      into v_org_code, v_vehicle_no
    from public.vehicles v
    join public.sites s on s.id = v.site_id
    where v.id = new.vehicle_id;

    if v_org_code is null then
      raise exception 'vehicle_id(%)에 해당하는 사업장/차량을 찾을 수 없습니다', new.vehicle_id;
    end if;

    v_scope_key := 'vehicle:' || new.vehicle_id::text;

    if new.extinguisher_no is null then
      perform pg_advisory_xact_lock(hashtext(v_scope_key));
      select coalesce(max(extinguisher_no), 0) + 1 into new.extinguisher_no
      from public.extinguishers
      where vehicle_id = new.vehicle_id and location_type = 'VEHICLE';
    end if;

    new.asset_code := v_org_code || '-차-' || v_vehicle_no || '-' || new.extinguisher_no;
  end if;

  return new;
end;
$$;

create trigger trg_set_extinguisher_asset_code
  before insert or update of location_type, floor_id, vehicle_id, extinguisher_no
  on public.extinguishers
  for each row execute function public.fn_set_extinguisher_asset_code();

-- 관리번호가 실제로 바뀐 경우에만 이전 값을 이력 테이블에 남긴다.
create or replace function public.fn_log_asset_code_change()
returns trigger
language plpgsql
as $$
begin
  if old.asset_code is distinct from new.asset_code then
    insert into public.asset_code_history (extinguisher_id, asset_code)
    values (old.id, old.asset_code);
  end if;
  return new;
end;
$$;

create trigger trg_log_asset_code_change
  after update of asset_code on public.extinguishers
  for each row execute function public.fn_log_asset_code_change();

-- 현재 관리번호 또는 과거(변경 전) 관리번호로 소화기를 찾는다.
-- QR 라벨은 재발급하지 않는 것이 원칙이므로, 관리번호가 바뀐 뒤에도 기존 라벨 스캔이 동작해야 한다.
create or replace function public.fn_find_extinguisher_id_by_code(p_code text)
returns uuid
language sql
stable
security invoker
as $$
  select coalesce(
    (select id from public.extinguishers where asset_code = p_code),
    (
      select extinguisher_id from public.asset_code_history
      where asset_code = p_code
      order by changed_at desc
      limit 1
    )
  );
$$;

-- 점검 이력: 감사 목적상 append-only (update/delete 정책 없음)
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  extinguisher_id uuid not null references public.extinguishers (id) on delete cascade,
  inspector_id uuid not null references public.profiles (id) on delete restrict,
  pressure_ok boolean not null,
  seal_ok boolean not null,
  appearance_ok boolean not null,
  installation_ok boolean not null,
  overall_result text not null check (overall_result in ('normal', 'abnormal')),
  memo text,
  -- 실제 점검 발생 시각(오프라인 시 클라이언트 시각). synced_at은 서버 반영 시각.
  inspected_at timestamptz not null,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_inspections_extinguisher on public.inspections (extinguisher_id, inspected_at desc);
create index idx_inspections_inspector on public.inspections (inspector_id);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_inspection_photos_inspection on public.inspection_photos (inspection_id);

-- 관리대장/현황에서 최근 점검의 "이상 내용"을 표시하기 위해
-- v_extinguisher_overview에 최근 점검의 비고(memo)와 4개 체크항목 결과를 노출한다.
-- CREATE OR REPLACE 규칙상 기존 컬럼 순서를 그대로 두고 맨 끝에만 추가한다.
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
  li.installation_ok as last_installation_ok
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
left join public.floors f on f.id = e.floor_id
left join public.vehicles veh on veh.id = e.vehicle_id
left join public.buildings b on b.id = coalesce(f.building_id, veh.building_id)
left join public.sites s on s.id = b.site_id
left join public.zones z on z.id = e.zone_id
left join lateral (
  select inspected_at, overall_result, inspector_id, memo,
         pressure_ok, seal_ok, appearance_ok, installation_ok
  from public.inspections i
  where i.extinguisher_id = e.id
  order by i.inspected_at desc
  limit 1
) li on true;

-- 목록/QR/수량 페이지용 경량 뷰.
-- v_extinguisher_overview는 소화기마다 "오늘 점검했나 / 이번달 점검했나"를 EXISTS 서브쿼리로
-- 계산하는데(수백 행이면 비용이 큼), 목록/QR/수량 페이지는 이 값을 쓰지 않는다.
-- 그 두 서브쿼리를 뺀 경량 뷰로 해당 페이지들의 조회를 가볍게 한다.
-- 최근 점검일(last_inspected_at 등, lateral)은 소화기 관리 목록에서 쓰므로 유지한다.
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
  e.serial_no as serial_no
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
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

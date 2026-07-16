-- 날짜 계산을 한국시간(Asia/Seoul) 기준으로 수정.
-- DB 서버는 UTC라서 current_date / inspected_at::date 가 한국 새벽 시간대(00~09시)에
-- 하루 어긋났다: 내용연수 상태 전환이 오전 9시에야 일어나고, 새벽에 수행한 점검이
-- '오늘 점검'으로 집계되지 않는 문제.

create or replace function public.fn_kst_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

create or replace function public.fn_extinguisher_status(p_manufacture_date date, p_useful_life_years int)
returns text
language sql
stable
as $$
  select case
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= public.fn_kst_today() then 'expired'
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= public.fn_kst_today() + 30 then 'due_30'
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= public.fn_kst_today() + 90 then 'due_90'
    else 'normal'
  end;
$$;

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
  coalesce(s_building.id, s_vehicle.id) as site_id,
  coalesce(s_building.name, s_vehicle.name) as site_name,
  coalesce(s_building.org_code, s_vehicle.org_code) as org_code,
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
left join public.buildings b on b.id = f.building_id
left join public.sites s_building on s_building.id = b.site_id
left join public.zones z on z.id = e.zone_id
left join public.vehicles veh on veh.id = e.vehicle_id
left join public.sites s_vehicle on s_vehicle.id = veh.site_id
left join lateral (
  select inspected_at, overall_result, inspector_id
  from public.inspections i
  where i.extinguisher_id = e.id
  order by i.inspected_at desc
  limit 1
) li on true;

-- 점검 체크항목에 "기타사항"(etc_ok)을 추가한다.
-- 압력/봉인/외관/설치 4개로 분류되지 않는 그 외 이상을 표시하기 위한 5번째 항목.
-- 기존 점검 기록은 기타사항 정상(true)으로 간주한다.

alter table public.inspections
  add column etc_ok boolean not null default true;

-- 점검 저장 함수: etc_ok 반영. 과거(오프라인 큐 등) etc_ok 없는 payload는 정상(true)으로 처리.
create or replace function public.fn_submit_inspection(p_payload jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_inspection_id uuid;
  v_photo_path text;
begin
  insert into public.inspections (
    extinguisher_id, inspector_id, pressure_ok, seal_ok, appearance_ok,
    installation_ok, etc_ok, overall_result, memo, inspected_at, synced_at
  )
  values (
    (p_payload ->> 'extinguisher_id')::uuid,
    auth.uid(),
    (p_payload ->> 'pressure_ok')::boolean,
    (p_payload ->> 'seal_ok')::boolean,
    (p_payload ->> 'appearance_ok')::boolean,
    (p_payload ->> 'installation_ok')::boolean,
    coalesce((p_payload ->> 'etc_ok')::boolean, true),
    p_payload ->> 'overall_result',
    p_payload ->> 'memo',
    (p_payload ->> 'inspected_at')::timestamptz,
    now()
  )
  returning id into v_inspection_id;

  for v_photo_path in
    select jsonb_array_elements_text(coalesce(p_payload -> 'photo_paths', '[]'::jsonb))
  loop
    insert into public.inspection_photos (inspection_id, storage_path)
    values (v_inspection_id, v_photo_path);
  end loop;

  return v_inspection_id;
end;
$$;

-- 최근 점검의 기타사항 결과를 뷰에 노출(끝에 last_etc_ok 추가).
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
  li.etc_ok as last_etc_ok
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
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

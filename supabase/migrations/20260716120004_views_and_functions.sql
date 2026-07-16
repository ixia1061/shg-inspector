-- 내용연수 상태 계산: "오늘" 기준값이라 컬럼으로 저장하지 않고 조회 시점에 계산한다.
create or replace function public.fn_extinguisher_status(p_manufacture_date date, p_useful_life_years int)
returns text
language sql
stable
as $$
  select case
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= current_date then 'expired'
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= current_date + 30 then 'due_30'
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= current_date + 90 then 'due_90'
    else 'normal'
  end;
$$;

-- 소화기 목록/대시보드/검색의 기본 소스가 되는 뷰.
-- 위치 전체 경로, 계산된 내용연수 상태, 최근 점검 정보를 한 번에 제공한다.
create or replace view public.v_extinguisher_overview
with (security_invoker = true) as
select
  e.id,
  e.qr_token,
  e.code,
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
  b.id as building_id,
  b.name as building_name,
  f.id as floor_id,
  f.name as floor_name,
  z.id as zone_id,
  z.name as zone_name,
  li.inspected_at as last_inspected_at,
  li.overall_result as last_inspection_result,
  li.inspector_id as last_inspector_id,
  exists (
    select 1 from public.inspections i2
    where i2.extinguisher_id = e.id and i2.inspected_at::date = current_date
  ) as inspected_today,
  exists (
    select 1 from public.inspections i3
    where i3.extinguisher_id = e.id
      and date_trunc('month', i3.inspected_at) = date_trunc('month', now())
  ) as inspected_this_month
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
join public.floors f on f.id = e.floor_id
left join public.zones z on z.id = e.zone_id
join public.buildings b on b.id = f.building_id
join public.sites s on s.id = b.site_id
left join lateral (
  select inspected_at, overall_result, inspector_id
  from public.inspections i
  where i.extinguisher_id = e.id
  order by i.inspected_at desc
  limit 1
) li on true;

-- 관리자 대시보드 요약 카드
create or replace function public.fn_dashboard_summary(p_site_id uuid default null)
returns table (
  total_extinguishers bigint,
  inspected_today bigint,
  not_inspected_today bigint,
  due_soon bigint,
  expired bigint,
  recent_abnormal bigint
)
language sql
stable
security invoker
as $$
  select
    count(*) as total_extinguishers,
    count(*) filter (where v.inspected_today) as inspected_today,
    count(*) filter (where not v.inspected_today) as not_inspected_today,
    count(*) filter (where v.lifecycle_status in ('due_30', 'due_90')) as due_soon,
    count(*) filter (where v.lifecycle_status = 'expired') as expired,
    (
      select count(*) from public.inspections i
      join public.extinguishers e on e.id = i.extinguisher_id
      where i.overall_result = 'abnormal'
        and i.inspected_at > now() - interval '7 days'
        and (
          p_site_id is null
          or e.floor_id in (
            select f.id from public.floors f
            join public.buildings b on b.id = f.building_id
            where b.site_id = p_site_id
          )
        )
    ) as recent_abnormal
  from public.v_extinguisher_overview v
  where p_site_id is null or v.site_id = p_site_id;
$$;

-- 건물/층/구역별 점검률 ('today' | 'month')
create or replace function public.fn_inspection_rate(
  p_group_by text default 'building',
  p_period text default 'month'
)
returns table (
  group_id uuid,
  group_name text,
  total bigint,
  inspected bigint,
  rate numeric
)
language sql
stable
security invoker
as $$
  select
    case p_group_by
      when 'floor' then v.floor_id
      when 'zone' then v.zone_id
      else v.building_id
    end as group_id,
    case p_group_by
      when 'floor' then v.floor_name
      when 'zone' then v.zone_name
      else v.building_name
    end as group_name,
    count(*) as total,
    count(*) filter (
      where (p_period = 'today' and v.inspected_today)
         or (p_period = 'month' and v.inspected_this_month)
    ) as inspected,
    round(
      100.0 * count(*) filter (
        where (p_period = 'today' and v.inspected_today)
           or (p_period = 'month' and v.inspected_this_month)
      ) / nullif(count(*), 0),
      1
    ) as rate
  from public.v_extinguisher_overview v
  group by 1, 2;
$$;

-- 점검 원자적 저장(점검 + 사진 메타). 오프라인 큐 flush 및 온라인 즉시 제출 양쪽에서 사용.
-- inspector_id는 클라이언트 입력을 신뢰하지 않고 auth.uid()로 서버에서 강제한다.
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
    installation_ok, overall_result, memo, inspected_at, synced_at
  )
  values (
    (p_payload ->> 'extinguisher_id')::uuid,
    auth.uid(),
    (p_payload ->> 'pressure_ok')::boolean,
    (p_payload ->> 'seal_ok')::boolean,
    (p_payload ->> 'appearance_ok')::boolean,
    (p_payload ->> 'installation_ok')::boolean,
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

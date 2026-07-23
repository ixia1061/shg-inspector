-- 이상사항 조치(조치필요 → 조치완료) 워크플로우.
-- 점검 기록(inspections)은 감사용 append-only라 수정하지 않고, 조치는 별도 append 테이블에 남긴다.
-- "이상(abnormal)으로 기록된 최근 점검"에 대해 관리자가 조치내용을 입력하고 완료 처리하면
-- 그 소화기가 이번달 점검완료로 집계된다.

create table public.inspection_actions (
  id uuid primary key default gen_random_uuid(),
  -- 조치 대상이 되는 이상 점검. 소화기당 최근 이상 점검 1건에 조치 1건이 대응한다.
  inspection_id uuid not null unique references public.inspections (id) on delete cascade,
  -- 조회 편의용 비정규화(현황/대시보드에서 소화기 기준 조인 없이 필터).
  extinguisher_id uuid not null references public.extinguishers (id) on delete cascade,
  action_note text not null,
  resolved_by uuid not null references public.profiles (id) on delete restrict,
  resolved_at timestamptz not null default now()
);
create index idx_inspection_actions_extinguisher on public.inspection_actions (extinguisher_id);

alter table public.inspection_actions enable row level security;

-- 관리자만 조회.
create policy "inspection_actions_admin_read" on public.inspection_actions
  for select using (public.is_admin());

-- 조치 기록/수정은 관리자 중에서도 담당 사업장 범위 내에서만. resolved_by 위조 방지.
create policy "inspection_actions_write" on public.inspection_actions
  for all
  using (
    public.is_admin()
    and public.has_site_access(public.fn_extinguisher_site_id(extinguisher_id))
  )
  with check (
    public.is_admin()
    and public.has_site_access(public.fn_extinguisher_site_id(extinguisher_id))
    and resolved_by = auth.uid()
  );

-- 최근 점검의 id와 조치 정보를 뷰에 노출. (CREATE OR REPLACE: 기존 컬럼 순서/타입 유지, 끝에만 추가)
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
  la.resolved_at as last_action_resolved_at
from public.extinguishers e
join public.extinguisher_types et on et.id = e.extinguisher_type_id
left join public.floors f on f.id = e.floor_id
left join public.vehicles veh on veh.id = e.vehicle_id
left join public.buildings b on b.id = coalesce(f.building_id, veh.building_id)
left join public.sites s on s.id = b.site_id
left join public.zones z on z.id = e.zone_id
left join lateral (
  select id, inspected_at, overall_result, inspector_id, memo,
         pressure_ok, seal_ok, appearance_ok, installation_ok
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

-- 대시보드 요약: "완료"를 조치 반영 기준으로 재정의하고 조치필요 카운트를 추가한다.
-- (반환 컬럼이 바뀌므로 drop 후 재생성)
drop function public.fn_dashboard_summary(uuid);

create function public.fn_dashboard_summary(p_site_id uuid default null)
returns table (
  total_extinguishers bigint,
  inspected_this_month bigint,
  not_inspected_this_month bigint,
  action_required bigint,
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
    -- 완료 = 이번달 점검됨 AND (정상 또는 이상이지만 조치완료)
    count(*) filter (
      where v.inspected_this_month
        and not (v.last_inspection_result = 'abnormal' and v.last_action_resolved_at is null)
    ) as inspected_this_month,
    count(*) filter (where not v.inspected_this_month) as not_inspected_this_month,
    -- 조치필요 = 이번달 점검됐지만 이상 + 미조치
    count(*) filter (
      where v.inspected_this_month
        and v.last_inspection_result = 'abnormal'
        and v.last_action_resolved_at is null
    ) as action_required,
    count(*) filter (where v.lifecycle_status in ('due_30', 'due_90')) as due_soon,
    count(*) filter (where v.lifecycle_status = 'expired') as expired,
    (
      select count(*) from public.inspections i
      join public.v_extinguisher_overview v2 on v2.id = i.extinguisher_id
      where i.overall_result = 'abnormal'
        and i.inspected_at > now() - interval '30 days'
        and (p_site_id is null or v2.site_id = p_site_id)
    ) as recent_abnormal
  from public.v_extinguisher_overview v
  where p_site_id is null or v.site_id = p_site_id;
$$;

-- 점검률: month 기간의 "완료"도 조치 반영 기준으로 맞춘다(조치필요는 미완료로 집계).
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
      when 'vehicle' then v.vehicle_id
      else v.building_id
    end as group_id,
    case p_group_by
      when 'floor' then v.floor_name
      when 'zone' then v.zone_name
      when 'vehicle' then v.vehicle_name
      else v.building_name
    end as group_name,
    count(*) as total,
    count(*) filter (
      where (p_period = 'today' and v.inspected_today)
         or (
           p_period = 'month' and v.inspected_this_month
           and not (v.last_inspection_result = 'abnormal' and v.last_action_resolved_at is null)
         )
    ) as inspected,
    round(
      100.0 * count(*) filter (
        where (p_period = 'today' and v.inspected_today)
           or (
             p_period = 'month' and v.inspected_this_month
             and not (v.last_inspection_result = 'abnormal' and v.last_action_resolved_at is null)
           )
      ) / nullif(count(*), 0),
      1
    ) as rate
  from public.v_extinguisher_overview v
  group by 1, 2;
$$;

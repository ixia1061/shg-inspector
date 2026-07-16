-- 소화기 점검은 월 1회 주기이므로 대시보드 집계를 '오늘' 기준에서 '이번달' 기준으로 변경한다.
-- 반환 컬럼명이 바뀌므로 drop 후 재생성.

drop function public.fn_dashboard_summary(uuid);

create function public.fn_dashboard_summary(p_site_id uuid default null)
returns table (
  total_extinguishers bigint,
  inspected_this_month bigint,
  not_inspected_this_month bigint,
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
    count(*) filter (where v.inspected_this_month) as inspected_this_month,
    count(*) filter (where not v.inspected_this_month) as not_inspected_this_month,
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

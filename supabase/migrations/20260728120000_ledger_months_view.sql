-- 관리대장 보관함: 사업장별로 "점검이 있었던 달" 목록을 뽑는 뷰.
--
-- 점검현황은 이번 달 점검에만 집중하고, 지난 달 대장은 별도 화면(/ledgers)에서 받는다.
-- 그 화면이 "어느 달을 고를 수 있는지"와 "그 달에 몇 대를 점검했는지"를 알아야 해서,
-- 점검 기록을 소화기 → 건물 → 사업장으로 이어 붙여 월 단위로 집계한다.
--
-- security_invoker라 다른 뷰들과 같게 RLS가 그대로 적용된다
-- (관리자는 자기 담당 사업장의 달만 보인다).
create or replace view public.v_ledger_months
with (security_invoker = true) as
select
  b.site_id as site_id,
  to_char(i.inspected_at at time zone 'Asia/Seoul', 'YYYY-MM') as month,
  count(distinct i.extinguisher_id)::int as inspected_count,
  count(*)::int as inspection_count,
  max(i.inspected_at) as last_inspected_at
from public.inspections i
join public.extinguishers e on e.id = i.extinguisher_id
left join public.floors f on f.id = e.floor_id
left join public.vehicles veh on veh.id = e.vehicle_id
join public.buildings b on b.id = coalesce(f.building_id, veh.building_id)
group by b.site_id, to_char(i.inspected_at at time zone 'Asia/Seoul', 'YYYY-MM');

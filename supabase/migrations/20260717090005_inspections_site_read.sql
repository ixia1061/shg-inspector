-- 점검자가 담당 사업장의 모든 점검 기록을 읽을 수 있게 한다.
-- 기존에는 본인 점검만 조회 가능해서, 동료가 이미 점검한 소화기도
-- 점검자 화면에서는 '미점검'으로 보이는 문제가 있었다.
-- (쓰기 정책은 그대로: 본인 명의 insert만 가능, update/delete 불가)

create policy "inspections_site_read" on public.inspections
  for select using (
    public.has_site_access(public.fn_extinguisher_site_id(extinguisher_id))
  );

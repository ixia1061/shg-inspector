-- 가입코드 조회를 관리자로 한정한다.
--
-- 기존 정책은 has_site_access(site_id)만 봐서 **그 사업장 점검자도 코드를 읽을 수** 있었다.
-- 화면에는 노출되지 않지만(점검자에게 사업장 관리 메뉴가 없음) API로는 읽혔다.
-- 코드는 관리자가 현장 점검자에게 전달하는 용도이므로, 읽기도 관리자 범위로 좁힌다.
-- (발급·재발급은 그대로 시스템관리자 전용)
drop policy if exists "site_join_codes_select" on public.site_join_codes;

create policy "site_join_codes_select_admin" on public.site_join_codes
  for select using (public.is_admin() and public.has_site_access(site_id));

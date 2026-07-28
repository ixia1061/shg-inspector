-- 일반 관리자도 자기 사업장의 관리파트를 추가·수정·삭제할 수 있게 한다.
--
-- 지금까지는 사업장과 같은 취급으로 시스템관리자 전용이었는데, 파트는 현장 조직이 바뀔 때마다
-- 손봐야 하는 값이라 담당 관리자가 직접 다루는 편이 맞다.
--
-- 다만 **자기가 사업장 전체를 담당하는 곳만** 열어준다(has_whole_site). 파트 코드를 바꾸면
-- fn_cascade_asset_code_from_part(security definer)가 그 파트 소속 소화기의 관리번호를
-- 연쇄로 다시 계산하는데, 사업장 일부(특정 파트)만 담당하는 관리자에게 열어주면 남의 파트
-- 코드를 바꿔 다른 팀 소화기의 관리번호까지 흔들 수 있기 때문이다.
--
-- 시스템관리자 전용 정책은 그대로 두고 OR로 합쳐진다.
create policy "management_parts_admin_write" on public.management_parts
  for all
  using (public.is_admin() and public.has_whole_site(site_id))
  with check (public.is_admin() and public.has_whole_site(site_id));

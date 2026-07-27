-- 일반 관리자가 자기 범위의 점검자 계정을 관리(가입 승인 + 활성/비활성)할 수 있게 넓힌다.
--
-- 직전 정책(profiles_admin_approve_signup)은 "가입 대기 중인 점검자"만 대상이라
-- 이미 승인된 점검자를 비활성 처리할 수 없었다. 대상 범위를 다음 세 가지로 넓힌다.
--   1) 내 담당 사업장에 가입 신청한 점검자        (승인)
--   2) 배정이 내 담당 범위와 겹치는 점검자         (활성/비활성)
--   3) 아직 아무 데도 배정되지 않은 점검자         (첫 배정 대상 — 점검자 배정 화면과 같은 규칙)
--
-- 역할은 여전히 점검자로 고정(with check)이라, 관리자가 누군가를 관리자로 올릴 수는 없다.
-- 실제 앱은 이 동작을 service_role 서버 액션으로 수행하지만(계정 삭제 등과 경로를 맞추려고),
-- 이 정책은 클라이언트 직접 쓰기에 대한 DB 레벨 방어선으로 함께 둔다.
drop policy if exists "profiles_admin_approve_signup" on public.profiles;

create policy "profiles_admin_manage_inspector" on public.profiles
  for update
  using (
    public.is_admin()
    and role = 'inspector'
    and (
      (pending_site_id is not null and public.has_site_access(pending_site_id))
      or exists (
        select 1 from public.user_sites us
        where us.user_id = profiles.id and public.has_site_access(us.site_id)
      )
      or exists (
        select 1 from public.user_parts up
        where up.user_id = profiles.id and public.has_part_access(up.part_id)
      )
      or (
        pending_site_id is null
        and not exists (select 1 from public.user_sites us where us.user_id = profiles.id)
        and not exists (select 1 from public.user_parts up where up.user_id = profiles.id)
      )
    )
  )
  with check (
    public.is_admin()
    and role = 'inspector'
  );

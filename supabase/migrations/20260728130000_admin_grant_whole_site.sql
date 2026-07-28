-- 관리자가 점검자에게 "사업장 단위"로 범위를 줄 때, 파트를 낱개로 나열하지 않고
-- user_sites 한 줄로 기록할 수 있게 한다.
--
-- 지금까지는 user_sites 쓰기가 시스템관리자 전용이라, 관리자가 사업장을 체크하면
-- 그 사업장의 파트를 전부 user_parts에 펼쳐 넣었다. 파트가 13개까지 늘면서 배정 한 번에
-- 행이 여러 개 쌓이고 담당 범위 표기도 "○○ 기계, ○○ 전기, …"처럼 길어졌다.
--
-- 경계는 그대로 지킨다: **자기가 사업장 전체(user_sites)를 가진 사업장만** 통째로 넘길 수 있다.
-- 파트만 담당하는 관리자는 자기 파트보다 넓은 권한을 만들 수 없어야 하므로 여기에 해당하지
-- 않으며, 그 경우 앱이 기존처럼 user_parts로 기록한다.

-- user_sites 정책 안에서 user_sites를 다시 조회하면 RLS가 재귀하므로 security definer로 감싼다.
create or replace function public.has_whole_site(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_sites us
    where us.user_id = auth.uid() and us.site_id = p_site_id
  );
$$;

-- 관리자는 "자기가 통째로 가진 사업장"을 "점검자"에게만 주고 뺄 수 있다.
-- (시스템관리자 전용 정책 user_sites_super_admin_all은 그대로 두고 OR로 합쳐진다)
create policy "user_sites_admin_grant_inspector" on public.user_sites
  for all
  using (
    public.is_admin()
    and public.has_whole_site(site_id)
    and exists (
      select 1 from public.profiles p
      where p.id = user_sites.user_id and p.role = 'inspector'
    )
  )
  with check (
    public.is_admin()
    and public.has_whole_site(site_id)
    and exists (
      select 1 from public.profiles p
      where p.id = user_sites.user_id and p.role = 'inspector'
    )
  );

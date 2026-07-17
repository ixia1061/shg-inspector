-- 시스템관리자(super_admin) 역할 도입
-- 역할 3단계: super_admin(시스템관리자) > admin(관리자) > inspector(점검자)
--  - super_admin: 모든 관리자 권한 + 사용자 추가/역할 변경 독점, 삭제 불가(앱에서 보호)
--  - admin: 사업장/건물/소화기 등 마스터데이터 관리 (사용자 관리는 불가)
--  - inspector: 점검/조회

-- 1) role 체크 제약에 super_admin 추가
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('super_admin', 'admin', 'inspector'));

-- 2) is_admin(): super_admin도 관리자 권한을 그대로 갖도록 포함
--    (기존 관리자용 RLS 정책 전체가 super_admin에도 적용됨)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

-- 3) is_super_admin(): 시스템관리자 전용 판별
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

-- 4) profiles 쓰기는 시스템관리자만 (일반 관리자가 API로 자기 역할을 바꾸는 것 차단)
--    실제 사용자 생성/역할변경은 서버에서 service_role로 수행되어 RLS를 우회하므로,
--    이 정책은 클라이언트 직접 쓰기에 대한 방어선이다.
drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_super_admin_write" on public.profiles
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- 5) user_sites 쓰기도 시스템관리자만 (사용자-사업장 배정은 사용자 관리의 일부)
drop policy if exists "user_sites_admin_all" on public.user_sites;
create policy "user_sites_super_admin_all" on public.user_sites
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- 6) 이 시스템의 시스템관리자 지정: ixia1061@gmail.com
--    (해당 계정이 없으면 0건 업데이트되어 안전)
update public.profiles
set role = 'super_admin', name = '시스템 관리자'
where id = (select id from auth.users where email = 'ixia1061@gmail.com');

-- 상위 관리자가 하위 관리자의 가입 신청도 볼 수 있게 한다.
--
-- 가입코드를 관리자별로 바꾸면서 "내 코드로 온 신청만" 보이게 했는데, 전체 사업장을 담당하는
-- 관리자(소방대=4곳)가 한 사업장만 담당하는 관리자(남부=1곳)의 신청을 못 보는 문제가 생겼다.
-- 요청한 계층(시스템관리자 > 전체 사업장 관리자 > 한 사업장 관리자)과 어긋난다.
--
-- 규칙: **코드 주인의 담당 사업장이 내 담당 사업장에 전부 포함되면** 그 신청을 보고 처리할 수
-- 있다. 자기 코드는 자기 범위에 당연히 포함되므로 그대로 보인다. 역방향(남부 → 소방대)은
-- 포함되지 않아 안 보인다. 역할을 새로 만들지 않고 배정 범위만으로 계층이 나온다.

-- user_sites는 RLS상 다른 관리자의 행을 읽을 수 없으므로 security definer로 감싼다.
create or replace function public.covers_admin_scope(p_admin_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_admin_id is not null
    -- 담당 사업장이 하나도 없는 관리자(시스템관리자 등)의 코드는 상위 위임 대상이 아니다.
    and exists (select 1 from public.user_sites where user_id = p_admin_id)
    -- 그 관리자의 사업장 중 내가 접근할 수 없는 곳이 하나라도 있으면 안 된다.
    and not exists (
      select 1 from public.user_sites owner_us
      where owner_us.user_id = p_admin_id
        and not public.has_site_access(owner_us.site_id)
    );
$$;

-- 화면에서 "내가 처리할 수 있는 코드 주인" 목록을 한 번에 받기 위한 함수.
-- (관리자는 다른 관리자의 user_sites를 못 읽어 앱에서 직접 계산할 수 없다)
create or replace function public.covered_admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.role in ('admin', 'super_admin')
    and public.covers_admin_scope(p.id);
$$;

-- 승인/관리 정책의 "대기 신청" 갈래를 계층 규칙으로 교체한다.
drop policy if exists "profiles_admin_manage_inspector" on public.profiles;

create policy "profiles_admin_manage_inspector" on public.profiles
  for update
  using (
    public.is_admin()
    and role = 'inspector'
    and (
      (pending_admin_id is not null
        and (public.is_super_admin() or public.covers_admin_scope(pending_admin_id)))
      or exists (
        select 1 from public.user_sites us
        where us.user_id = profiles.id and public.has_site_access(us.site_id)
      )
      or exists (
        select 1 from public.user_parts up
        where up.user_id = profiles.id and public.has_part_access(up.part_id)
      )
      or (
        pending_admin_id is null
        and not exists (select 1 from public.user_sites us where us.user_id = profiles.id)
        and not exists (select 1 from public.user_parts up where up.user_id = profiles.id)
      )
    )
  )
  with check (
    public.is_admin()
    and role = 'inspector'
  );

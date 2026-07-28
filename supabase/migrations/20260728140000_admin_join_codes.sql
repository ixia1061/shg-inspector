-- 가입코드를 사업장이 아니라 **관리자**에게 붙인다.
--
-- 사업장에 코드를 붙이면, 여러 사업장을 담당하는 관리자(소방대 관리자=4곳)가 자기에게 온
-- 점검자에게 그중 어디를 맡길지 고를 수 없다. "한국공항공사 코드로 온 사람 = 한국공항공사만"
-- 으로 고정되기 때문이다. 코드를 관리자에게 붙이면 승인할 때 자기 담당 사업장 중에서 고를 수
-- 있고, 남부 관리자처럼 한 곳만 담당하면 자연히 그 한 곳만 줄 수 있다.
--
-- 권한 계층(시스템관리자 > 여러 사업장 관리자 > 한 사업장 관리자)은 배정된 사업장 범위에서
-- 이미 나오므로 역할을 새로 만들지 않는다. 가입 경로도 같은 원리를 따르게 하는 것이다.

-- ---------------------------------------------------------------------------
-- 1) 관리자별 가입코드 (관리자당 1행)
-- ---------------------------------------------------------------------------
create table public.admin_join_codes (
  admin_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.admin_join_codes enable row level security;

-- 관리자는 **자기 코드만** 본다(남의 코드로 가입 신청을 돌리는 것 방지).
-- 발급·재발급은 시스템관리자만. 가입 화면은 비로그인이라 서버 액션이 service_role로 조회한다.
create policy "admin_join_codes_select_own_or_super" on public.admin_join_codes
  for select using (admin_id = auth.uid() or public.is_super_admin());

create policy "admin_join_codes_super_admin_write" on public.admin_join_codes
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 2) 가입 신청 대상: 사업장 → 관리자
-- ---------------------------------------------------------------------------
-- 승인 대기 = is_active = false AND pending_admin_id is not null
alter table public.profiles
  add column pending_admin_id uuid references public.profiles (id) on delete set null;

create index idx_profiles_pending_admin on public.profiles (pending_admin_id)
  where pending_admin_id is not null;

-- 옛 컬럼을 참조하는 정책을 먼저 걷어내야 컬럼을 지울 수 있다.
drop policy if exists "profiles_admin_manage_inspector" on public.profiles;

-- 대기 중인 신청이 없어 옮길 데이터가 없다.
drop index if exists idx_profiles_pending_site;
alter table public.profiles drop column pending_site_id;

-- ---------------------------------------------------------------------------
-- 3) 승인/관리 정책의 "대기 신청" 조건을 관리자 기준으로 다시 만든다
-- ---------------------------------------------------------------------------
-- 나머지 두 갈래(배정이 내 범위와 겹침 / 아직 미배정)는 그대로 둔다.
create policy "profiles_admin_manage_inspector" on public.profiles
  for update
  using (
    public.is_admin()
    and role = 'inspector'
    and (
      (pending_admin_id is not null
        and (pending_admin_id = auth.uid() or public.is_super_admin()))
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

-- ---------------------------------------------------------------------------
-- 4) 사업장별 가입코드 폐기 (관리자 코드로 일원화)
-- ---------------------------------------------------------------------------
drop table if exists public.site_join_codes;

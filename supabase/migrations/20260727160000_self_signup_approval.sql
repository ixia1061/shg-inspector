-- 점검자 자가 회원가입 + 사업장 관리자 승인
--
-- 흐름: 시스템관리자가 사업장별 가입코드 발급 → 점검자가 /signup에서 코드로 신청
--       → 그 사업장 관리자가 승인하면서 관리파트 지정 → 그때부터 로그인·점검 가능.
--
-- 승인 대기 상태 = is_active = false AND pending_site_id is not null.
-- 별도 상태 컬럼을 두지 않고 기존 is_active를 승인 플래그로 승격시켜 게이트를 한 곳에 모은다.

-- ---------------------------------------------------------------------------
-- 1) 사업장별 가입코드 (사업장당 1행, 재발급하면 옛 코드는 즉시 무효)
-- ---------------------------------------------------------------------------
create table public.site_join_codes (
  site_id uuid primary key references public.sites (id) on delete cascade,
  code text not null unique,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.site_join_codes enable row level security;

-- 읽기는 그 사업장에 접근 권한이 있는 관리자만. 가입 화면(비로그인)은 이 테이블을 직접
-- 읽지 않고 서버 액션이 service_role로 조회하므로 anon 권한을 열지 않는다.
create policy "site_join_codes_select" on public.site_join_codes
  for select using (public.has_site_access(site_id));

create policy "site_join_codes_super_admin_write" on public.site_join_codes
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 2) profiles 확장
-- ---------------------------------------------------------------------------
-- email: 승인 화면에서 신청자를 식별하려면 필요하다(원래 이메일은 auth.users에만 있어
--        service_role 없이는 못 읽는다). 트리거가 채우고, 기존 사용자는 아래에서 백필.
-- pending_site_id: 어느 사업장에 가입 신청했는지. 승인 시 null로 비운다.
alter table public.profiles
  add column email text,
  add column pending_site_id uuid references public.sites (id) on delete set null;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create index idx_profiles_pending_site on public.profiles (pending_site_id)
  where pending_site_id is not null;

-- ---------------------------------------------------------------------------
-- 3) 가입 트리거 재작성 — 메타데이터의 role을 신뢰하지 않는다
-- ---------------------------------------------------------------------------
-- 기존 구현은 raw_user_meta_data->>'role'을 그대로 profile에 넣었다. 공개 가입이 없던
-- 동안에는 문제가 없었지만, 가입 화면을 여는 순간 누구나 role: 'admin'을 심어 관리자가
-- 될 수 있는 권한 상승 경로가 된다. 항상 안전한 기본값(점검자·비활성)으로 만들고,
-- 권한이 검증된 서버 액션만 그 뒤에 값을 올린다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.email,
    'inspector',
    false
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) is_active 실효화 — 지금까지는 표시용 플래그였다
-- ---------------------------------------------------------------------------
-- is_active는 컬럼과 관리 화면 토글만 있고 로그인·RLS 어디에서도 검사하지 않아,
-- 비활성 사용자도 정상적으로 데이터에 접근할 수 있었다. 승인 대기 계정을 막으려면
-- 권한 헬퍼 자체를 좁혀야 한다. 뷰·RPC가 모두 security invoker라 함수만 바꾸면
-- 전체에 적용된다. 기존 사용자는 전원 is_active = true라 영향이 없다.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role = 'super_admin'
  );
$$;

create or replace function public.has_site_access(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and (
    public.is_super_admin()
    or exists (
      select 1 from public.user_sites us
      where us.user_id = auth.uid() and us.site_id = p_site_id
    )
    or exists (
      select 1 from public.user_parts up
      join public.management_parts mp on mp.id = up.part_id
      where up.user_id = auth.uid() and mp.site_id = p_site_id
    )
  );
$$;

create or replace function public.has_part_access(p_part_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and (
    public.is_super_admin()
    or exists (
      select 1 from public.user_sites us
      join public.management_parts mp on mp.site_id = us.site_id
      where us.user_id = auth.uid() and mp.id = p_part_id
    )
    or exists (
      select 1 from public.user_parts up
      where up.user_id = auth.uid() and up.part_id = p_part_id
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 5) 승인용 profiles UPDATE 정책
-- ---------------------------------------------------------------------------
-- profiles 쓰기는 시스템관리자 전용(profiles_super_admin_write) 하나뿐이라 일반
-- 관리자가 승인할 수 없다. user_parts_write와 같은 형태로 범위를 좁힌 정책을 추가한다.
-- (정책은 OR로 합쳐지므로 기존 정책은 그대로 둔다.)
--   USING      = 손댈 수 있는 행: 내 사업장에 신청한, 대기 중인 점검자만
--   WITH CHECK = 바꾼 뒤의 행: 역할을 점검자에서 올릴 수 없다
create policy "profiles_admin_approve_signup" on public.profiles
  for update
  using (
    public.is_admin()
    and role = 'inspector'
    and is_active = false
    and pending_site_id is not null
    and public.has_site_access(pending_site_id)
  )
  with check (
    public.is_admin()
    and role = 'inspector'
  );

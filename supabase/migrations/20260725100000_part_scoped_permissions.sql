-- 관리파트 도입 2단계: 권한을 사업장에서 "파트" 단위로 세분화한다.
--  - user_sites(기존) = 사업장 전체 배정(그 사업장의 현재·미래 모든 파트).
--  - user_parts(신규) = 특정 파트만 배정.
--  - 소화기/점검 스코프는 파트 단위(has_part_access), 건물/층 등 구조는 사업장 단위(has_site_access) 유지.
--
-- 하위호환: user_parts가 하나도 없으면 모든 판정이 user_sites로 귀결되어 기존 접근 범위가 그대로 유지된다.
-- 소화기 part_id는 항상 채워져 있으므로(1단계 backfill + 트리거) 파트 스코프 읽기가 안전하다.

-- 1) user_parts 테이블 ------------------------------------------------------
create table public.user_parts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  part_id uuid not null references public.management_parts (id) on delete cascade,
  primary key (user_id, part_id)
);
create index idx_user_parts_part on public.user_parts (part_id);

alter table public.user_parts enable row level security;

-- 2) 헬퍼 함수 --------------------------------------------------------------
-- 소화기가 속한 파트 id (RLS 공용)
create or replace function public.fn_extinguisher_part_id(p_extinguisher_id uuid)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select part_id from public.extinguishers where id = p_extinguisher_id;
$$;

-- 파트 접근권: 시스템관리자 / 사업장 전체 배정(user_sites) / 특정 파트 배정(user_parts)
create or replace function public.has_part_access(p_part_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.user_sites us
      join public.management_parts mp on mp.site_id = us.site_id
      where us.user_id = auth.uid() and mp.id = p_part_id
    )
    or exists (
      select 1 from public.user_parts up
      where up.user_id = auth.uid() and up.part_id = p_part_id
    );
$$;

-- 사업장 접근권: 파트 일부만 배정된 사용자도 그 사업장의 건물/층 "구조"는 볼 수 있어야 한다.
create or replace function public.has_site_access(p_site_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1 from public.user_sites us
      where us.user_id = auth.uid() and us.site_id = p_site_id
    )
    or exists (
      select 1 from public.user_parts up
      join public.management_parts mp on mp.id = up.part_id
      where up.user_id = auth.uid() and mp.site_id = p_site_id
    );
$$;

-- 3) user_parts RLS --------------------------------------------------------
-- 읽기: 본인 또는 관리자.
create policy "user_parts_select_own_or_admin" on public.user_parts
  for select using (user_id = auth.uid() or public.is_admin());

-- 쓰기: 시스템관리자 전량(계정 관리는 service_role로 수행되어 RLS 우회) 또는
--       일반 관리자가 "자기 관리 파트"를 "점검자"에게 배정/해제(관리자 경계 자동 강제).
create policy "user_parts_write" on public.user_parts
  for all
  using (
    public.is_super_admin()
    or (
      public.is_admin()
      and public.has_part_access(part_id)
      and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'inspector')
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.is_admin()
      and public.has_part_access(part_id)
      and exists (select 1 from public.profiles p where p.id = user_id and p.role = 'inspector')
    )
  );

-- 4) 소화기/점검 RLS를 파트 스코프로 교체 --------------------------------------
drop policy "extinguishers_inspector_read" on public.extinguishers;
create policy "extinguishers_part_read" on public.extinguishers
  for select using (public.has_part_access(part_id));

drop policy "extinguishers_admin_write" on public.extinguishers;
create policy "extinguishers_admin_write" on public.extinguishers
  for all
  using (public.is_admin() and public.has_part_access(part_id))
  with check (public.is_admin() and public.has_part_access(part_id));

-- 점검: 읽기/쓰기 모두 소화기의 파트 기준
drop policy "inspections_site_read" on public.inspections;
create policy "inspections_part_read" on public.inspections
  for select using (
    public.has_part_access(public.fn_extinguisher_part_id(extinguisher_id))
  );

drop policy "inspections_insert_own" on public.inspections;
create policy "inspections_insert_own" on public.inspections
  for insert with check (
    inspector_id = auth.uid()
    and public.has_part_access(public.fn_extinguisher_part_id(extinguisher_id))
  );

-- 점검 사진: 소화기 파트 기준 읽기
drop policy "inspection_photos_site_read" on public.inspection_photos;
create policy "inspection_photos_part_read" on public.inspection_photos
  for select using (
    public.has_part_access(public.fn_extinguisher_part_id(
      (select i.extinguisher_id from public.inspections i where i.id = inspection_id)))
  );

-- 관리번호 이력: 소화기 파트 기준 읽기
drop policy "asset_code_history_site_read" on public.asset_code_history;
create policy "asset_code_history_part_read" on public.asset_code_history
  for select using (
    public.has_part_access(public.fn_extinguisher_part_id(extinguisher_id))
  );

-- 이상 조치: 소화기 파트 기준(관리자 중 그 파트 접근권 보유자만)
drop policy "inspection_actions_admin_read" on public.inspection_actions;
create policy "inspection_actions_read" on public.inspection_actions
  for select using (
    public.is_admin() and public.has_part_access(public.fn_extinguisher_part_id(extinguisher_id))
  );

drop policy "inspection_actions_write" on public.inspection_actions;
create policy "inspection_actions_write" on public.inspection_actions
  for all
  using (
    public.is_admin()
    and public.has_part_access(public.fn_extinguisher_part_id(extinguisher_id))
  )
  with check (
    public.is_admin()
    and public.has_part_access(public.fn_extinguisher_part_id(extinguisher_id))
    and resolved_by = auth.uid()
  );

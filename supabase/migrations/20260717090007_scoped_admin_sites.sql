-- 일반 관리자를 "배정된 담당 사업장"으로 제한한다.
--  - 사업장 생성/수정/삭제: 시스템관리자(super_admin) 전용
--  - 건물/층/구역/차량/소화기/점검: 관리자는 배정된 사업장 범위 내에서만 (super_admin은 전체)
--  - has_site_access를 super_admin 기준으로 좁혀, 뷰/RPC(security invoker)까지 자동으로 사업장 스코핑됨

-- 1) has_site_access: is_admin() → is_super_admin() 로 변경 (일반 관리자도 배정된 사업장만 접근)
create or replace function public.has_site_access(p_site_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_sites us
    where us.user_id = auth.uid() and us.site_id = p_site_id
  );
$$;

-- 2) 기존 일반 관리자가 갑자기 접근을 잃지 않도록, 현재 존재하는 모든 사업장을 배정해 둔다.
--    (이후 시스템관리자가 사용자 관리에서 담당 사업장을 좁힐 수 있다.)
insert into public.user_sites (user_id, site_id)
select p.id, s.id
from public.profiles p
cross join public.sites s
where p.role = 'admin'
on conflict do nothing;

-- 3) sites: 쓰기는 시스템관리자만. 읽기는 배정된 사업장(=has_site_access)만.
drop policy if exists "sites_admin_write" on public.sites;
create policy "sites_super_admin_write" on public.sites
  for all using (public.is_super_admin()) with check (public.is_super_admin());
-- sites_inspector_read (using has_site_access(id))는 그대로 두면 관리자/점검자/super 모두 배정 사업장만 읽음

-- 4) 건물/층/구역/차량/소화기 쓰기: is_admin() AND 해당 사업장 접근권
--    (super_admin은 has_site_access가 항상 true → 전체. 일반 관리자는 배정 사업장만. 점검자는 is_admin false → 불가)
drop policy if exists "buildings_admin_write" on public.buildings;
create policy "buildings_admin_write" on public.buildings
  for all
  using (public.is_admin() and public.has_site_access(site_id))
  with check (public.is_admin() and public.has_site_access(site_id));

drop policy if exists "floors_admin_write" on public.floors;
create policy "floors_admin_write" on public.floors
  for all
  using (public.is_admin() and public.has_site_access(
    (select b.site_id from public.buildings b where b.id = building_id)))
  with check (public.is_admin() and public.has_site_access(
    (select b.site_id from public.buildings b where b.id = building_id)));

drop policy if exists "zones_admin_write" on public.zones;
create policy "zones_admin_write" on public.zones
  for all
  using (public.is_admin() and public.has_site_access(
    (select b.site_id from public.buildings b
     join public.floors f on f.building_id = b.id where f.id = floor_id)))
  with check (public.is_admin() and public.has_site_access(
    (select b.site_id from public.buildings b
     join public.floors f on f.building_id = b.id where f.id = floor_id)));

drop policy if exists "vehicles_admin_write" on public.vehicles;
create policy "vehicles_admin_write" on public.vehicles
  for all
  using (public.is_admin() and public.has_site_access(
    (select b.site_id from public.buildings b where b.id = building_id)))
  with check (public.is_admin() and public.has_site_access(
    (select b.site_id from public.buildings b where b.id = building_id)));

drop policy if exists "extinguishers_admin_write" on public.extinguishers;
create policy "extinguishers_admin_write" on public.extinguishers
  for all
  using (public.is_admin() and public.has_site_access(coalesce(
    (select b.site_id from public.floors f
       join public.buildings b on b.id = f.building_id where f.id = floor_id),
    (select b.site_id from public.vehicles v
       join public.buildings b on b.id = v.building_id where v.id = vehicle_id))))
  with check (public.is_admin() and public.has_site_access(coalesce(
    (select b.site_id from public.floors f
       join public.buildings b on b.id = f.building_id where f.id = floor_id),
    (select b.site_id from public.vehicles v
       join public.buildings b on b.id = v.building_id where v.id = vehicle_id))));

-- 5) 점검/사진/관리번호 이력 읽기: 관리자 무조건 읽기(is_admin) 정책을 사업장 스코프로 교체
drop policy if exists "inspections_admin_read" on public.inspections;
-- inspections_site_read (has_site_access(fn_extinguisher_site_id(...)))가 이미 있어 스코프 읽기를 담당

drop policy if exists "inspection_photos_admin_read" on public.inspection_photos;
create policy "inspection_photos_site_read" on public.inspection_photos
  for select using (
    public.has_site_access(public.fn_extinguisher_site_id(
      (select i.extinguisher_id from public.inspections i where i.id = inspection_id)))
  );

drop policy if exists "asset_code_history_admin_read" on public.asset_code_history;
create policy "asset_code_history_site_read" on public.asset_code_history
  for select using (
    public.has_site_access(public.fn_extinguisher_site_id(extinguisher_id))
  );

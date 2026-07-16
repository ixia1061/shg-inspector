-- RLS 활성화
alter table public.sites enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.zones enable row level security;
alter table public.extinguisher_types enable row level security;
alter table public.extinguishers enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.user_sites enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_admin_write" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- user_sites ---------------------------------------------------------------
create policy "user_sites_admin_all" on public.user_sites
  for all using (public.is_admin()) with check (public.is_admin());

create policy "user_sites_select_own" on public.user_sites
  for select using (user_id = auth.uid());

-- sites ---------------------------------------------------------------
create policy "sites_admin_write" on public.sites
  for all using (public.is_admin()) with check (public.is_admin());

create policy "sites_inspector_read" on public.sites
  for select using (public.has_site_access(id));

-- buildings ---------------------------------------------------------------
create policy "buildings_admin_write" on public.buildings
  for all using (public.is_admin()) with check (public.is_admin());

create policy "buildings_inspector_read" on public.buildings
  for select using (public.has_site_access(site_id));

-- floors ---------------------------------------------------------------
create policy "floors_admin_write" on public.floors
  for all using (public.is_admin()) with check (public.is_admin());

create policy "floors_inspector_read" on public.floors
  for select using (
    public.has_site_access((select b.site_id from public.buildings b where b.id = building_id))
  );

-- zones ---------------------------------------------------------------
create policy "zones_admin_write" on public.zones
  for all using (public.is_admin()) with check (public.is_admin());

create policy "zones_inspector_read" on public.zones
  for select using (
    public.has_site_access((
      select b.site_id from public.buildings b
      join public.floors f on f.building_id = b.id
      where f.id = floor_id
    ))
  );

-- extinguisher_types (룩업, 로그인 사용자 전체 읽기 허용) --------------------
create policy "types_read_all" on public.extinguisher_types
  for select using (auth.uid() is not null);

create policy "types_admin_write" on public.extinguisher_types
  for all using (public.is_admin()) with check (public.is_admin());

-- extinguishers ---------------------------------------------------------------
create policy "extinguishers_admin_write" on public.extinguishers
  for all using (public.is_admin()) with check (public.is_admin());

create policy "extinguishers_inspector_read" on public.extinguishers
  for select using (
    public.has_site_access((
      select b.site_id from public.buildings b
      join public.floors f on f.building_id = b.id
      where f.id = floor_id
    ))
  );

-- inspections (append-only: update/delete 정책을 두지 않아 감사 무결성 보장) --
create policy "inspections_admin_read" on public.inspections
  for select using (public.is_admin());

create policy "inspections_own_read" on public.inspections
  for select using (inspector_id = auth.uid());

create policy "inspections_insert_own" on public.inspections
  for insert with check (
    inspector_id = auth.uid()
    and public.has_site_access((
      select b.site_id from public.extinguishers e
      join public.floors f on f.id = e.floor_id
      join public.buildings b on b.id = f.building_id
      where e.id = extinguisher_id
    ))
  );

-- inspection_photos ---------------------------------------------------------------
create policy "inspection_photos_admin_read" on public.inspection_photos
  for select using (public.is_admin());

create policy "inspection_photos_own_read" on public.inspection_photos
  for select using (
    exists (select 1 from public.inspections i where i.id = inspection_id and i.inspector_id = auth.uid())
  );

create policy "inspection_photos_insert_own" on public.inspection_photos
  for insert with check (
    exists (select 1 from public.inspections i where i.id = inspection_id and i.inspector_id = auth.uid())
  );

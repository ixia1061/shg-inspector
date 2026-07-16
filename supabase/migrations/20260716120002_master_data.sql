-- 사업장 > 건물 > 층 > 구역(선택) 계층 구조

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  manager_name text,
  manager_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_buildings_site on public.buildings (site_id);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_floors_building on public.floors (building_id);

-- 구역은 선택 계층: 소화기는 zone 없이 floor에 직접 소속될 수 있음
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index idx_zones_floor on public.zones (floor_id);

create table public.extinguisher_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_useful_life_years int not null default 10
);

-- 점검자 - 담당 사업장 배정 (사업장별 접근 제한용)
create table public.user_sites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  primary key (user_id, site_id)
);
create index idx_user_sites_site on public.user_sites (site_id);

-- admin이거나, 해당 사업장에 배정된 사용자인지 확인
create or replace function public.has_site_access(p_site_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.user_sites us
    where us.user_id = auth.uid() and us.site_id = p_site_id
  );
$$;

-- 소화기 자산 테이블
create table public.extinguishers (
  id uuid primary key default gen_random_uuid(),
  -- QR에는 qr_token만 인코딩 (분실/파손 시 재발급 가능, 순차 ID 노출 방지)
  qr_token uuid not null unique default gen_random_uuid(),
  code text not null unique,
  floor_id uuid not null references public.floors (id) on delete restrict,
  zone_id uuid references public.zones (id) on delete set null,
  extinguisher_type_id uuid not null references public.extinguisher_types (id) on delete restrict,
  manufacture_date date not null,
  useful_life_years int not null,
  capacity text,
  install_note text,
  status text not null default 'active' check (status in ('active', 'replaced', 'disposed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_extinguishers_floor on public.extinguishers (floor_id);
create index idx_extinguishers_zone on public.extinguishers (zone_id);
create index idx_extinguishers_qr_token on public.extinguishers (qr_token);

-- 점검 이력: 감사 목적상 append-only (update/delete 정책 없음)
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  extinguisher_id uuid not null references public.extinguishers (id) on delete cascade,
  inspector_id uuid not null references public.profiles (id) on delete restrict,
  pressure_ok boolean not null,
  seal_ok boolean not null,
  appearance_ok boolean not null,
  installation_ok boolean not null,
  overall_result text not null check (overall_result in ('normal', 'abnormal')),
  memo text,
  -- 실제 점검 발생 시각(오프라인 시 클라이언트 시각). synced_at은 서버 반영 시각.
  inspected_at timestamptz not null,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_inspections_extinguisher on public.inspections (extinguisher_id, inspected_at desc);
create index idx_inspections_inspector on public.inspections (inspector_id);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_inspection_photos_inspection on public.inspection_photos (inspection_id);

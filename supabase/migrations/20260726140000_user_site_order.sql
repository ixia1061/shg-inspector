-- 관리자별 개인 사업장 표시 순서. 점검현황·수량현황 상단의 사업장 버튼 순서를
-- 관리자 계정마다 원하는 대로 바꿀 수 있게 한다(전체 공통 순서가 아니라 개인 설정).
--
-- profiles 테이블에 컬럼을 추가하는 대신 별도 테이블로 분리한 이유: profiles의 쓰기는
-- 시스템관리자 전용(profiles_super_admin_write, 일반 관리자가 자기 role 등을 직접 고치는
-- 것을 막기 위함)이라, 이 개인 설정만을 위해 그 경계를 건드리고 싶지 않았다. 별도 테이블로
-- 두면 "본인 행만 조작 가능"이라는 단순한 RLS로 안전하게 분리된다(user_sites/user_parts와
-- 같은 패턴).

create table public.user_site_order (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- 표시하고 싶은 순서대로 나열한 site_id 배열. 목록에 없는 사업장은 뒤에 이름순으로 붙는다.
  site_order jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_site_order enable row level security;

create policy "user_site_order_own" on public.user_site_order
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

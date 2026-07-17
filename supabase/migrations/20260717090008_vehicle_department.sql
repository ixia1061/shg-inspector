-- 차량에 관리부서(소방/전기/통신 등)를 추가한다.
alter table public.vehicles add column if not exists department text;

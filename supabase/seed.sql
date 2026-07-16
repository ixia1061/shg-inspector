-- 기본 소화기 종류 시드 데이터
insert into public.extinguisher_types (name, default_useful_life_years) values
  ('분말소화기', 10),
  ('이산화탄소소화기', 10),
  ('할론소화기', 10),
  ('강화액소화기', 8),
  ('포소화기', 8)
on conflict (name) do nothing;

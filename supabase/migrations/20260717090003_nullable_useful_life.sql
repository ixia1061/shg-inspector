-- 내용연수 없음 지원: 이산화탄소·할론 등 일부 소화기는 내용연수(교체기한)가 없다.
-- useful_life_years를 nullable로 바꾸고, 내용연수가 없으면 lifecycle_status = 'none'으로 계산한다.

alter table public.extinguishers alter column useful_life_years drop not null;
alter table public.extinguisher_types alter column default_useful_life_years drop not null;
alter table public.extinguisher_types alter column default_useful_life_years drop default;

-- 기본 시드 종류 중 내용연수가 없는 소화기 반영
update public.extinguisher_types set default_useful_life_years = null
where name in ('이산화탄소소화기', '할론소화기');

-- 내용연수 없음 → 'none' (만료 관리 대상 아님)
create or replace function public.fn_extinguisher_status(p_manufacture_date date, p_useful_life_years int)
returns text
language sql
stable
as $$
  select case
    when p_useful_life_years is null then 'none'
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= public.fn_kst_today() then 'expired'
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= public.fn_kst_today() + 30 then 'due_30'
    when (p_manufacture_date + (p_useful_life_years || ' years')::interval)::date <= public.fn_kst_today() + 90 then 'due_90'
    else 'normal'
  end;
$$;

-- 뷰의 replace_due_date는 useful_life_years가 null이면 자동으로 null이 되므로 재생성 불필요.
-- (null || ' years' → null interval → date + null → null)

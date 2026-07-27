-- 버그 수정: 관리번호(asset_code) 변경이 RLS에 막혀 실패하던 문제.
--
-- 증상: 소화기의 건물/층/파트를 바꿔 관리번호가 달라지는 수정을 하면
--   "new row violates row-level security policy for table asset_code_history" (42501)
-- 로 실패했다. 시스템관리자(super_admin)도 동일하게 막혔다.
--
-- 원인: asset_code_history에는 SELECT 정책만 있고 INSERT 정책이 없는데,
--   이력을 남기는 트리거 fn_log_asset_code_change가 security invoker(호출자 권한)라
--   RLS의 적용을 받았다. INSERT를 허용하는 정책이 하나도 없으므로 누구도 통과할 수 없다.
--   (같은 계열의 fn_cascade_asset_code_from_part는 이미 security definer로 되어 있었다.)
--
-- 해결: 이력 트리거를 security definer로 바꾼다. asset_code_history는 앱이 직접 쓰지 않고
--   오직 이 트리거만 기록하는 감사 테이블이므로, INSERT 정책을 여는 대신(= 클라이언트가
--   임의의 이력을 써넣을 수 있게 되는 것) 트리거에만 권한을 준다. 읽기는 기존 정책 그대로
--   파트 접근권이 있는 사람만 볼 수 있다.

create or replace function public.fn_log_asset_code_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.asset_code is distinct from new.asset_code then
    insert into public.asset_code_history (extinguisher_id, asset_code)
    values (old.id, old.asset_code);
  end if;
  return new;
end;
$$;

-- 관리파트 쓰기 권한을 다시 시스템관리자 전용으로 되돌린다.
--
-- 직전(20260728150000)에 "사업장 전체를 담당하는 관리자"에게도 열었으나, 사용자 판단으로
-- 취소한다. 파트 코드는 관리번호(부착된 QR 라벨)와 직결되는 값이라 한 곳에서 통제하는 편이
-- 안전하다는 결론.
--
-- 시스템관리자 정책(management_parts_super_admin_write)과 읽기 정책은 그대로 두므로,
-- 관리자는 예전처럼 파트를 **보기만** 한다.
drop policy if exists "management_parts_admin_write" on public.management_parts;

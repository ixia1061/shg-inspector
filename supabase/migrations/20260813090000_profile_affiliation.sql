-- 점검자 소속(부서·업체) 추가
--
-- 가입 신청 화면에는 이름·이메일밖에 없어서, 관리자가 승인할 때 이 사람이 어느 팀인지
-- 알 수 없었다(남부공항서비스처럼 파트가 6개인 곳은 특히). 신청자가 직접 적은 소속을
-- 함께 받아 승인·범위 배정의 판단 근거로 쓴다.
--
-- 주의: 소속은 **신청자가 스스로 적은 참고 정보**다. 권한은 지금처럼 관리자가 고른
-- 사업장에서만 나오며, 이 값으로 자동 배정하지 않는다.

alter table public.profiles
  add column affiliation text;

comment on column public.profiles.affiliation is
  '소속(부서·업체). 가입 신청자가 직접 입력하고 관리자가 수정할 수 있다. 권한과 무관한 참고 정보.';

-- 관리자가 자기 범위 점검자의 소속을 고칠 수 있어야 한다.
-- 기존 profiles_admin_manage_inspector 정책(update, role = 'inspector' 한정)이
-- 그대로 이 컬럼도 덮으므로 새 정책은 필요 없다.

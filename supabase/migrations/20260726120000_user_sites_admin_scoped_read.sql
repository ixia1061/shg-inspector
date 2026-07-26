-- /assignments(점검자 배정) 화면에서 "사업장 전체 배정된 점검자는 파트 체크가
-- 의미 없다"는 것을 관리자에게 보여주려면, 일반 관리자도 자기 담당 범위 안의
-- 점검자에 대해서는 user_sites(사업장 전체 배정) 여부를 읽을 수 있어야 한다.
--
-- 기존에는 user_sites SELECT가 본인 행(user_sites_select_own) 또는
-- 시스템관리자(user_sites_super_admin_all)로만 한정되어, 일반 관리자는 다른
-- 사용자(점검자)의 user_sites를 전혀 볼 수 없었다. 그 결과 화면에서 "전체 배정됨"
-- 여부를 판단할 수 없어 빈 체크박스만 보이고, 체크해도 이미 전체 권한이 있어
-- 아무 효력이 없는데 그 사실을 관리자가 알 방법이 없었다(오늘 발견된 혼동 사례).
--
-- 노출 범위는 최소화한다: 자기 has_site_access(그 사업장)가 있는 관리자가,
-- role='inspector'인 대상의 user_sites만 읽을 수 있다. 다른 관리자의 사업장
-- 배정이나, 자기 담당 범위 밖 사업장의 배정은 여전히 보이지 않는다.

create policy "user_sites_select_admin_scoped" on public.user_sites
  for select using (
    public.is_admin()
    and public.has_site_access(site_id)
    and exists (
      select 1 from public.profiles p
      where p.id = user_sites.user_id and p.role = 'inspector'
    )
  );

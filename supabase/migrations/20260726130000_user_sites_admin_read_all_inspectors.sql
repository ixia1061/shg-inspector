-- 어제(20260726120000) 추가한 user_sites_select_admin_scoped는 "자기 담당 범위 안"의
-- user_sites만 보여준다. 그런데 /assignments(점검자 배정) 화면에서 "이 점검자는 다른
-- 관리자 팀(다른 사업장) 소속이라 내 목록에서 숨겨야 한다"를 판단하려면, 범위 밖 배정도
-- (그 내용을 보여주지 않더라도) 존재 여부는 알아야 한다 — 지금은 범위 밖 배정이 아예 안
-- 보여서 오히려 "미배정"처럼 보여 여전히 노출되는 문제가 있었다.
--
-- user_parts는 이미 모든 관리자에게 전량 열람이 허용되어 있다(user_parts_select_own_or_admin:
-- `is_admin()` 조건만, 범위 제한 없음). user_sites도 "점검자 대상 행"에 한해 동일하게
-- 넓힌다 — 실제 쓰기(배정 자체)는 여전히 시스템관리자 전용(user_sites_super_admin_all)이라
-- 권한 경계는 그대로 유지되고, 이건 열람 범위만 user_parts와 맞추는 것이다.

drop policy "user_sites_select_admin_scoped" on public.user_sites;

create policy "user_sites_select_admin_or_own" on public.user_sites
  for select using (
    user_id = auth.uid()
    or public.is_super_admin()
    or (
      public.is_admin()
      and exists (
        select 1 from public.profiles p
        where p.id = user_sites.user_id and p.role = 'inspector'
      )
    )
  );

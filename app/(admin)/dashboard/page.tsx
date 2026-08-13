import { DashboardClient } from "@/components/admin/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import { sortSitesByPreference } from "@/lib/utils/sort";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 요약·점검률·조치필요를 모두 소화기 뷰 한 벌로 클라이언트에서 집계한다
  // (사업장 전환 시 서버 왕복 없음). 이상점검 이력은 /abnormal 화면에서 따로 조회한다.
  const [{ data: overviewRows }, { data: sites }, { data: orderRow }] = await Promise.all([
    supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
    supabase.from("sites").select("*").order("name"),
    user
      ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 사업장 버튼 순서는 관리자 개인 설정(내 계정 → 사업장 표시 순서)을 따른다.
  const orderedSites = sortSitesByPreference(sites ?? [], orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <DashboardClient extinguishers={overviewRows ?? []} sites={orderedSites} />
    </div>
  );
}

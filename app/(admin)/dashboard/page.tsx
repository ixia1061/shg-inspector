import { subDays } from "date-fns";

import { DashboardClient } from "@/components/admin/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import { sortSitesByPreference } from "@/lib/utils/sort";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 요약·점검률은 소화기 뷰 한 번으로 클라이언트에서 집계한다(사업장 전환 시 서버 왕복 없음).
  // 최근 30일 이상점검만 점검 기록 기반이라 따로 조회한다.
  const since = subDays(new Date(), 30).toISOString();
  const [{ data: overviewRows }, { data: abnormalRows }, { data: sites }, { data: orderRow }] =
    await Promise.all([
      supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
      supabase
        .from("inspections")
        .select("extinguisher_id")
        .eq("overall_result", "abnormal")
        .gte("inspected_at", since),
      supabase.from("sites").select("*").order("name"),
      user
        ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const rows = overviewRows ?? [];

  // 최근 이상점검을 사업장별로 세기 위해 소화기 → 사업장으로 매핑한다.
  const siteByExtinguisher = new Map(rows.map((r) => [r.id, r.site_id]));
  const recentAbnormalSiteIds = (abnormalRows ?? [])
    .map((i) => siteByExtinguisher.get(i.extinguisher_id))
    .filter((s): s is string => Boolean(s));

  // 사업장 버튼 순서는 관리자 개인 설정(내 계정 → 사업장 표시 순서)을 따른다.
  const orderedSites = sortSitesByPreference(sites ?? [], orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      <DashboardClient
        extinguishers={rows}
        sites={orderedSites}
        recentAbnormalSiteIds={recentAbnormalSiteIds}
      />
    </div>
  );
}

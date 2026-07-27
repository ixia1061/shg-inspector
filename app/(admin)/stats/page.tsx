import { StatsClient, type MonthInspection } from "@/components/admin/StatsClient";
import { createClient } from "@/lib/supabase/server";
import { sortSitesByPreference } from "@/lib/utils/sort";

export default async function StatsPage() {
  const supabase = await createClient();

  // 이번달(KST) 시작 시각을 UTC ISO로 계산한다. 서버(UTC)에서 new Date()로 월초를 잡으면
  // 경계가 9시간 어긋나 KST 1일 00:00~09:00 점검이 이번달에서 누락된다.
  const kstToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  const startOfMonthIso = new Date(`${kstToday.slice(0, 7)}-01T00:00:00+09:00`).toISOString();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: overviewRows }, { data: monthInspections }, { data: sites }, { data: orderRow }] =
    await Promise.all([
      supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
      supabase
        .from("inspections")
        .select("inspector_id, overall_result, extinguisher_id")
        .gte("inspected_at", startOfMonthIso),
      supabase.from("sites").select("*").order("name"),
      user
        ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const inspectorIds = [...new Set((monthInspections ?? []).map((i) => i.inspector_id))];
  const { data: inspectors } = inspectorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", inspectorIds)
    : { data: [] };
  const nameById = new Map((inspectors ?? []).map((p) => [p.id, p.name]));

  // 점검 기록에는 사업장이 없으므로 소화기 → 사업장으로 매핑해 사업장별 실적을 낼 수 있게 한다.
  const rows = overviewRows ?? [];
  const siteByExtinguisher = new Map(rows.map((r) => [r.id, r.site_id]));

  const inspections: MonthInspection[] = (monthInspections ?? []).map((i) => ({
    inspector_id: i.inspector_id,
    inspector_name: nameById.get(i.inspector_id) ?? "알 수 없음",
    site_id: siteByExtinguisher.get(i.extinguisher_id) ?? null,
    abnormal: i.overall_result === "abnormal",
  }));

  // 사업장 버튼 순서는 관리자 개인 설정(내 계정 → 사업장 표시 순서)을 따른다.
  const orderedSites = sortSitesByPreference(sites ?? [], orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">통계</h1>

      <StatsClient extinguishers={rows} sites={orderedSites} monthInspections={inspections} />
    </div>
  );
}

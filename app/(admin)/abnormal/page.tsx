import { AbnormalClient } from "@/components/admin/AbnormalClient";
import type { AbnormalInspectionItem } from "@/components/admin/AbnormalHistoryList";
import { createClient } from "@/lib/supabase/server";
import { kstDateKey } from "@/lib/utils/datetime";
import { defectItemsTextOfInspection } from "@/lib/utils/inspection";
import { formatShortLocation } from "@/lib/utils/location";
import { sortSitesByPreference } from "@/lib/utils/sort";

/**
 * 이상점검 화면 — 대시보드의 "조치 필요" 카드에서 들어온다.
 *
 * 위쪽에 **조치 안 된 이상**을 달과 무관하게 모아 두고(지난달 것이 사라지지 않게),
 * 아래에 이상점검 이력을 월 헤더와 함께 최신순으로 보여준다.
 */
export default async function AbnormalPage({
  searchParams,
}: {
  // 대시보드 조치 필요 카드에서 사업장을 지정해 들어온다("all"이면 전체).
  searchParams: Promise<{ site?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 점검 기록은 RLS로 담당 범위만 읽히고, 소화기 정보는 뷰에서 붙인다.
  const [{ data: rows }, { data: inspections }, { data: sites }, { data: orderRow }] =
    await Promise.all([
      supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
      supabase
        .from("inspections")
        .select("*")
        .eq("overall_result", "abnormal")
        .order("inspected_at", { ascending: false }),
      supabase.from("sites").select("*").order("name"),
      user
        ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const extinguishers = rows ?? [];
  const abnormalInspections = inspections ?? [];

  // 조치 기록·점검자 이름을 한 번에 붙인다(행마다 조회하지 않는다).
  const inspectionIds = abnormalInspections.map((i) => i.id);
  const { data: actions } = inspectionIds.length
    ? await supabase
        .from("inspection_actions")
        .select("inspection_id, action_note, resolved_at")
        .in("inspection_id", inspectionIds)
    : { data: [] };
  const actionByInspection = new Map((actions ?? []).map((a) => [a.inspection_id, a]));

  const { data: profiles } = await supabase.from("profiles").select("id, name");
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  const extById = new Map(extinguishers.map((e) => [e.id, e]));

  // "이후 재점검됨" 판단용 — 소화기별 최근 점검 시각(뷰의 last_inspected_at)과 비교한다.
  const history: AbnormalInspectionItem[] = abnormalInspections.flatMap((i) => {
    const e = extById.get(i.extinguisher_id);
    if (!e) return []; // 삭제된 소화기 등
    const action = actionByInspection.get(i.id);
    return [
      {
        id: i.id,
        extinguisherId: e.id,
        assetCode: e.asset_code,
        siteId: e.site_id,
        location: formatShortLocation(e),
        inspectedAt: i.inspected_at,
        monthKey: kstDateKey(i.inspected_at).slice(0, 7),
        inspectorName: nameById.get(i.inspector_id) ?? "-",
        memo: i.memo,
        defectItems: defectItemsTextOfInspection(i as unknown as Record<string, unknown>),
        actionNote: action?.action_note ?? null,
        resolvedAt: action?.resolved_at ?? null,
        superseded: !!e.last_inspected_at && e.last_inspected_at > i.inspected_at,
      },
    ];
  });

  const orderedSites = sortSitesByPreference(sites ?? [], orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">이상점검</h1>
      <AbnormalClient
        extinguishers={extinguishers}
        history={history}
        sites={orderedSites}
        initialSiteId={sp.site}
      />
    </div>
  );
}

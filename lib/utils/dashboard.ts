import { isActionNeeded, isMonthDone } from "@/lib/utils/inspection";
import type { DashboardSummary, ExtinguisherOverview, InspectionRateRow } from "@/types/domain";

/**
 * 대시보드 요약 집계. DB의 fn_dashboard_summary()와 같은 기준으로 계산한다.
 * (사업장 전환을 서버 왕복 없이 처리하려고 뷰 데이터를 클라이언트에서 집계한다.)
 * - 점검완료 = 이번달 점검됨 AND 조치필요 아님
 * - recent_abnormal만 점검 기록 기반이라 별도로 넘겨받는다.
 */
export function summarizeExtinguishers(
  rows: ExtinguisherOverview[],
  recentAbnormal: number
): DashboardSummary {
  let inspected = 0;
  let actionRequired = 0;
  let dueSoon = 0;
  let expired = 0;

  for (const r of rows) {
    if (isMonthDone(r)) inspected += 1;
    if (isActionNeeded(r)) actionRequired += 1;
    if (r.lifecycle_status === "due_30" || r.lifecycle_status === "due_90") dueSoon += 1;
    if (r.lifecycle_status === "expired") expired += 1;
  }

  return {
    total_extinguishers: rows.length,
    inspected_this_month: inspected,
    not_inspected_this_month: rows.filter((r) => !r.inspected_this_month).length,
    action_required: actionRequired,
    due_soon: dueSoon,
    expired,
    recent_abnormal: recentAbnormal,
  };
}

/**
 * 건물별 이번달 점검률. DB의 fn_inspection_rate(building, month)와 같은 기준.
 * 사업장을 "전체"로 볼 때는 건물명이 사업장끼리 겹치므로(관리동·동력동 등)
 * withSiteName을 켜서 어느 사업장 건물인지 구분한다.
 */
export function buildingInspectionRates(
  rows: ExtinguisherOverview[],
  opts?: { withSiteName?: boolean }
): InspectionRateRow[] {
  const groups = new Map<string, { name: string; total: number; inspected: number }>();

  for (const r of rows) {
    if (!r.building_id) continue;
    const label = r.building_name ?? `${r.building_no ?? ""}동`;
    const name = opts?.withSiteName ? `${r.site_name} · ${label}` : label;
    let g = groups.get(r.building_id);
    if (!g) {
      g = { name, total: 0, inspected: 0 };
      groups.set(r.building_id, g);
    }
    g.total += 1;
    if (isMonthDone(r)) g.inspected += 1;
  }

  return [...groups.entries()]
    .map(([group_id, g]) => ({
      group_id,
      group_name: g.name,
      total: g.total,
      inspected: g.inspected,
      rate: g.total > 0 ? Math.round((1000 * g.inspected) / g.total) / 10 : 0,
    }))
    .sort((a, b) => a.group_name.localeCompare(b.group_name, "ko", { numeric: true }));
}

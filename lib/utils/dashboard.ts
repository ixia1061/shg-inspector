import { isActionNeeded, isMonthDone } from "@/lib/utils/inspection";
import type { ExtinguisherOverview, InspectionRateRow } from "@/types/domain";

/**
 * 대시보드 카드에 쓰는 요약값.
 * DB의 `fn_dashboard_summary()`(= types/domain의 DashboardSummary)와 달리 소화기 뷰 한 벌로
 * 클라이언트에서 계산한다(사업장 전환에 서버 왕복이 없다). RPC에 있던 `recent_abnormal`
 * (최근 30일 이상점검 건수)은 2026-08-13에 뺐다 — 조치완료된 것까지 세는 숫자라 "지금 할 일"과
 * 어긋났고, 이상점검 이력은 `/abnormal` 화면에서 전부 본다.
 */
export interface DashboardSummaryView {
  total_extinguishers: number;
  inspected_this_month: number;
  not_inspected_this_month: number;
  action_required: number;
  due_soon: number;
  expired: number;
}

/**
 * 대시보드 요약 집계.
 * - 점검완료 = 이번달 점검됨 AND 조치필요 아님
 * - 조치필요 = 최근 점검이 이상 + 미조치 (**달로 자르지 않는다** — 지난달 것도 남는다)
 */
export function summarizeExtinguishers(rows: ExtinguisherOverview[]): DashboardSummaryView {
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

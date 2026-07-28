import type { ExtinguisherOverview } from "@/types/domain";

/**
 * 관리대장 "점검사항" 6개. 배열 순서가 곧 점검 화면 체크 순서이자 관리대장 컬럼 순서.
 * - key: inspections 테이블 컬럼(점검 저장 payload)
 * - viewKey: v_extinguisher_overview의 최근 점검 값
 */
export const LEDGER_CHECK_ITEMS = [
  {
    key: "agent_discharge_ok",
    viewKey: "last_agent_discharge_ok",
    label: "약제방출 정상",
    header: "약제방출",
    defectLabel: "약제방출 불량",
  },
  {
    key: "agent_caking_ok",
    viewKey: "last_agent_caking_ok",
    label: "약제응고 정상",
    header: "약제응고",
    defectLabel: "약제응고 불량",
  },
  {
    key: "gauge_ok",
    viewKey: "last_gauge_ok",
    label: "게이지상태 정상",
    header: "게이지상태",
    defectLabel: "게이지 불량",
  },
  {
    key: "handle_ok",
    viewKey: "last_handle_ok",
    label: "손잡이상태 정상",
    header: "손잡이상태",
    defectLabel: "손잡이 불량",
  },
  {
    key: "hose_ok",
    viewKey: "last_hose_ok",
    label: "호스상태 정상",
    header: "호스상태",
    defectLabel: "호스 불량",
  },
  {
    key: "hose_holder_ok",
    viewKey: "last_hose_holder_ok",
    label: "호스걸이 정상",
    header: "호스걸이",
    defectLabel: "호스걸이 불량",
  },
] as const;

/** 점검 화면 체크항목 = 관리대장 점검사항 6개 + 기타사항(상세는 이상 내용에 수기 기입). */
export const INSPECTION_CHECK_ITEMS = [
  ...LEDGER_CHECK_ITEMS,
  {
    key: "etc_ok",
    viewKey: "last_etc_ok",
    label: "기타사항 정상",
    defectLabel: "기타 불량",
  },
] as const;

export type InspectionCheckKey = (typeof INSPECTION_CHECK_ITEMS)[number]["key"];

/** 2026-07-27 이전 체크항목. 그때의 점검 기록에만 값이 있어 있을 때만 표시한다. */
const LEGACY_CHECK_ITEMS = [
  { viewKey: "last_pressure_ok", defectLabel: "압력 불량" },
  { viewKey: "last_seal_ok", defectLabel: "봉인 불량" },
  { viewKey: "last_appearance_ok", defectLabel: "외관 불량" },
  { viewKey: "last_installation_ok", defectLabel: "설치 불량" },
] as const;

/** 최근 점검에서 불량으로 체크된 항목 목록. 정상/미점검이면 빈 배열. */
export function defectItemList(e: ExtinguisherOverview): string[] {
  const failed: string[] = [];
  for (const item of INSPECTION_CHECK_ITEMS) {
    if (e[item.viewKey] === false) failed.push(item.defectLabel);
  }
  for (const item of LEGACY_CHECK_ITEMS) {
    if (e[item.viewKey] === false) failed.push(item.defectLabel);
  }
  return failed;
}

/** 불량 항목을 ", "로 이어붙인 문자열. 정상/미점검이면 빈 문자열. */
export function defectItemsText(e: ExtinguisherOverview): string {
  return defectItemList(e).join(", ");
}

/** 2026-07-27 이전 체크항목의 원본 컬럼명(점검 이력 표시용). */
const LEGACY_INSPECTION_KEYS = [
  { key: "pressure_ok", defectLabel: "압력 불량" },
  { key: "seal_ok", defectLabel: "봉인 불량" },
  { key: "appearance_ok", defectLabel: "외관 불량" },
  { key: "installation_ok", defectLabel: "설치 불량" },
] as const;

/**
 * `inspections` 행(원본 컬럼) 기준 불량 항목 문자열.
 * 뷰의 `last_*`가 아니라 점검 한 건을 그대로 볼 때 쓴다(소화기 상세의 점검 이력).
 */
export function defectItemsTextOfInspection(row: Record<string, unknown>): string {
  const failed: string[] = [];
  for (const item of INSPECTION_CHECK_ITEMS) {
    if (row[item.key] === false) failed.push(item.defectLabel);
  }
  for (const item of LEGACY_INSPECTION_KEYS) {
    if (row[item.key] === false) failed.push(item.defectLabel);
  }
  return failed.join(", ");
}

/** 이번달 점검됐지만 이상 + 미조치 상태(관리자 조치 필요). */
export function isActionNeeded(e: ExtinguisherOverview): boolean {
  return (
    e.inspected_this_month &&
    e.last_inspection_result === "abnormal" &&
    !e.last_action_resolved_at
  );
}

/**
 * 이번달 이상이 있었으나 조치완료된 소화기.
 * inspected_this_month(최근 점검이 이번달)로 gate하므로, 매달 1일 점검이 새로 시작되면
 * 자연히 목록에서 빠진다(그달의 조치만 표시).
 */
export function isActionResolved(e: ExtinguisherOverview): boolean {
  return (
    e.inspected_this_month &&
    e.last_inspection_result === "abnormal" &&
    !!e.last_action_resolved_at
  );
}

/** 이번달 정상 점검완료(이상 없음). */
export function isNormalDone(e: ExtinguisherOverview): boolean {
  return e.inspected_this_month && e.last_inspection_result === "normal";
}

/** 이번달 점검완료(정상 또는 이상이지만 조치완료) — 점검률 집계 기준. */
export function isMonthDone(e: ExtinguisherOverview): boolean {
  return e.inspected_this_month && !isActionNeeded(e);
}

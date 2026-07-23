import type { ExtinguisherOverview } from "@/types/domain";

/** 최근 점검에서 불량으로 체크된 항목 목록. 정상/미점검이면 빈 배열. */
export function defectItemList(e: ExtinguisherOverview): string[] {
  const failed: string[] = [];
  if (e.last_pressure_ok === false) failed.push("압력 불량");
  if (e.last_seal_ok === false) failed.push("봉인 불량");
  if (e.last_appearance_ok === false) failed.push("외관 불량");
  if (e.last_installation_ok === false) failed.push("설치 불량");
  return failed;
}

/** 불량 항목을 ", "로 이어붙인 문자열. 정상/미점검이면 빈 문자열. */
export function defectItemsText(e: ExtinguisherOverview): string {
  return defectItemList(e).join(", ");
}

/** 이번달 점검됐지만 이상 + 미조치 상태(관리자 조치 필요). */
export function isActionNeeded(e: ExtinguisherOverview): boolean {
  return (
    e.inspected_this_month &&
    e.last_inspection_result === "abnormal" &&
    !e.last_action_resolved_at
  );
}

/** 이번달 점검완료(정상 또는 이상이지만 조치완료). */
export function isMonthDone(e: ExtinguisherOverview): boolean {
  return e.inspected_this_month && !isActionNeeded(e);
}

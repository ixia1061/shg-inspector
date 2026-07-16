import { addDays, addYears, differenceInCalendarDays } from "date-fns";

import type { LifecycleStatus } from "@/types/database.types";

/**
 * DB의 fn_extinguisher_status()와 동일한 규칙을 클라이언트에서 재현한다.
 * 오프라인 캐시 화면 등 서버 조회 없이 상태 배지를 즉시 보여줘야 할 때 사용한다.
 * 서버(뷰)가 저장된 값의 원본(source of truth)이며, 이 함수는 표시용 근사치다.
 */
export function computeLifecycleStatus(
  manufactureDate: string,
  usefulLifeYears: number,
  today: Date = new Date()
): LifecycleStatus {
  const replaceDueDate = addYears(new Date(manufactureDate), usefulLifeYears);

  if (differenceInCalendarDays(replaceDueDate, today) <= 0) return "expired";
  if (replaceDueDate <= addDays(today, 30)) return "due_30";
  if (replaceDueDate <= addDays(today, 90)) return "due_90";
  return "normal";
}

export const LIFECYCLE_STATUS_LABEL: Record<LifecycleStatus, string> = {
  normal: "정상",
  due_90: "교체 90일 전",
  due_30: "교체 30일 전",
  expired: "만료",
};

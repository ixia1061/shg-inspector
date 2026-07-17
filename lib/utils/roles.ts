import type { UserRole } from "@/types/domain";

/** 역할 한글 표기 */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "시스템관리자",
  admin: "관리자",
  inspector: "점검자",
};

/** 사용자 생성/역할 변경 시 배정 가능한 역할 (시스템관리자는 UI로 배정 불가) */
export const ASSIGNABLE_ROLE_ITEMS: { value: UserRole; label: string }[] = [
  { value: "inspector", label: "점검자" },
  { value: "admin", label: "관리자" },
];

/** 관리자 권한(대시보드·마스터데이터·소화기 등)을 가진 역할인가. 시스템관리자 포함. */
export function isAdminRole(role?: string | null): boolean {
  return role === "admin" || role === "super_admin";
}

/** 시스템관리자(최상위)인가. 사용자 관리 권한 판별에 사용. */
export function isSuperAdminRole(role?: string | null): boolean {
  return role === "super_admin";
}

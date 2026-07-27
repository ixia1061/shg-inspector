import type { ManagementPart } from "@/types/domain";

/**
 * 관리파트 표시 라벨. 이름과 코드가 다르면 관리번호 앞자리(코드)를 함께 보여준다.
 * (예: 한국공항공사의 파트는 이름 "소방" / 코드 "공사" → "소방 (공사)")
 */
export function formatPartLabel(part: Pick<ManagementPart, "name" | "code">): string {
  return part.name === part.code ? part.name : `${part.name} (${part.code})`;
}

/**
 * 사업장 선택에 맞춰 고를 수 있는 파트만 남긴다("all"이면 전체).
 * 코드는 전체에서 유일하므로 전체 사업장일 때도 라벨만으로 구분된다.
 */
export function partsForSite<T extends { site_id: string }>(parts: T[], siteId: string): T[] {
  return siteId === "all" ? parts : parts.filter((p) => p.site_id === siteId);
}

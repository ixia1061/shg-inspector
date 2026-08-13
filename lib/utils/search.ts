/**
 * 검색어 비교용 정규화 — 대소문자와 공백을 무시한다.
 * 관리번호·제조번호·위치는 띄어쓰기가 제각각이라(`여객청사 1층` / `여객청사1층`)
 * 공백까지 정확히 맞춰야 검색되면 현장에서 쓰기 불편하다.
 */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, "");
}

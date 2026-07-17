// 관리번호(asset_code) 등 "숫자가 섞인 문자열"을 사람이 기대하는 순서로 정렬한다.
// 일반 문자열 정렬은 "공사-15"가 "공사-2"보다 앞, "공사-1-1-10"이 "...-2"보다 앞으로 오는
// 문제가 있어 숫자 인식(numeric) 정렬을 쓴다.
export function compareAssetCode(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function sortByAssetCode<T extends { asset_code: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareAssetCode(a.asset_code, b.asset_code));
}

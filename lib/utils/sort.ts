// 관리번호(asset_code) 등 "숫자가 섞인 문자열"을 사람이 기대하는 순서로 정렬한다.
// 일반 문자열 정렬은 "공사-15"가 "공사-2"보다 앞, "공사-1-1-10"이 "...-2"보다 앞으로 오는
// 문제가 있어 숫자 인식(numeric) 정렬을 쓴다.
export function compareAssetCode(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

export function sortByAssetCode<T extends { asset_code: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => compareAssetCode(a.asset_code, b.asset_code));
}

/**
 * 내용연수 관리 목록 정렬: 급한 상태(만료 → 30일 → 90일)를 먼저, 같은 상태 안에서는
 * 관리번호 순. 만료 목록을 관리번호 순으로 훑으며 현장에서 교체할 수 있게 하기 위함이다.
 * (교체 예정일은 상태 안에서 뒤섞이지만 목록에 그대로 표시된다.)
 */
const LIFECYCLE_URGENCY: Record<string, number> = { expired: 0, due_30: 1, due_90: 2 };

export function sortByLifecycleUrgency<
  T extends { asset_code: string; lifecycle_status: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ua = LIFECYCLE_URGENCY[a.lifecycle_status] ?? 99;
    const ub = LIFECYCLE_URGENCY[b.lifecycle_status] ?? 99;
    return ua - ub || compareAssetCode(a.asset_code, b.asset_code);
  });
}

/**
 * 관리자 개인 설정(user_site_order)에 따라 사업장 목록을 정렬한다. 설정에 없는 사업장은
 * (신규 사업장 등) 기존 순서를 유지한 채 뒤로 밀린다 — Array.sort는 안정 정렬이므로
 * 호출 전 이름순으로 정렬해 넘기면 미설정 사업장끼리는 이름순을 유지한다.
 */
export function sortSitesByPreference<T extends { id: string }>(
  sites: T[],
  order: string[] | null | undefined
): T[] {
  if (!order || order.length === 0) return sites;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...sites].sort((a, b) => {
    const ai = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

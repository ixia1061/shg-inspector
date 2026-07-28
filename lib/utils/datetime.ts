/**
 * 날짜·시각 표시는 **항상 KST(Asia/Seoul)** 로 고정한다.
 *
 * toLocaleString에 timeZone을 주지 않으면 실행 환경의 시간대를 따르는데,
 * 서버 컴포넌트는 Vercel(UTC)에서 렌더링되므로 9시간 이르게(=새벽처럼) 보인다.
 * 클라이언트에서도 기기 시간대가 어긋나면 같은 문제가 생기므로 양쪽 다 고정한다.
 */
const KST = "Asia/Seoul";

/** 'YYYY. M. D.' — 날짜만 (KST) */
export function formatKstDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: KST });
}

/** 'YYYY. M. D. 오전 9:15' — 날짜+시각 (KST) */
export function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: KST });
}

/**
 * 'YYYY-MM-DD' (KST) — 파일명·폴더명처럼 정렬 가능한 형식이 필요할 때.
 * 인자를 비우면 오늘. toISOString()을 쓰면 UTC라 00:00~09:00 사이에 하루가 어긋난다.
 */
export function kstDateKey(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-CA", { timeZone: KST });
}

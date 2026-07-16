/**
 * QR 코드에는 사람이 읽는 관리번호(asset_code)를 그대로 인코딩한다.
 * 원칙적으로 QR은 재발급하지 않으며, 관리번호가 부득이 바뀌더라도
 * asset_code_history를 통해 과거 QR 스캔도 현재 소화기로 정상 연결된다.
 */
export function buildInspectionUrl(assetCode: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${origin}/inspect/${encodeURIComponent(assetCode)}`;
}

/**
 * QR 코드에는 순차 ID 대신 qr_token(uuid)만 노출한다.
 * 라벨 분실/파손 시 extinguishers.qr_token만 재발급하면 code/이력은 그대로 유지된다.
 */
export function buildInspectionUrl(qrToken: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${origin}/inspect/${qrToken}`;
}

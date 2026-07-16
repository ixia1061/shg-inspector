/**
 * QR 스캔 통행증.
 * 점검자는 실제로 QR을 스캔해야만 점검 화면에 들어갈 수 있다 — 스캔 성공 시
 * 세션 스토리지에 (관리번호, 시각)을 기록하고, 점검 화면은 이 기록이
 * 유효(동일 관리번호 + 10분 이내)할 때만 열린다. 관리자는 검사를 면제받는다.
 */

const KEY = "qr-scan-pass";
const VALID_MS = 10 * 60 * 1000;

export function setScanPass(assetCode: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ code: assetCode, ts: Date.now() }));
  } catch {
    // 스토리지 사용 불가 환경이면 통행증 없이 진행 (점검 화면에서 거부됨)
  }
}

export function hasValidScanPass(assetCode: string): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const { code, ts } = JSON.parse(raw) as { code: string; ts: number };
    return code === assetCode && Date.now() - ts < VALID_MS;
  } catch {
    return false;
  }
}

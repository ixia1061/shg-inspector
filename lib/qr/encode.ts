/**
 * QR 코드에는 사람이 읽는 관리번호(asset_code)를 그대로 인코딩한다.
 * (과거엔 절대 URL 전체를 인코딩했으나, 한글 관리번호가 encodeURIComponent를 거치며
 * 3배 이상 부풀고 도메인까지 더해져 QR이 필요 이상으로 커져 저사양 폰 인식률이
 * 떨어지는 문제가 있었다 — 스캔 처리(app/(inspector)/scan/page.tsx의 extractAssetCode)는
 * 원래 "URL이 아니면 텍스트 자체를 관리번호로 취급"하는 폴백이 있어 관리번호만
 * 인코딩해도 동작에 문제가 없다.)
 * 원칙적으로 QR은 재발급하지 않으며, 관리번호가 부득이 바뀌더라도
 * asset_code_history를 통해 과거 QR 스캔도 현재 소화기로 정상 연결된다.
 */
export function buildQrPayload(assetCode: string): string {
  return assetCode.trim();
}

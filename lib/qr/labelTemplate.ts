/** Zebra ZPL 라벨 템플릿. QR + 관리번호 + 위치를 한 장에 인쇄한다. */
export function buildZpl({
  url,
  code,
  location,
}: {
  url: string;
  code: string;
  location: string;
}): string {
  const escape = (s: string) => s.replace(/[\^~]/g, "");
  return [
    "^XA",
    `^FO40,40^BQN,2,6^FDQA,${escape(url)}^FS`,
    `^FO40,260^A0N,28,28^FD${escape(code)}^FS`,
    `^FO40,300^A0N,20,20^FD${escape(location)}^FS`,
    "^XZ",
  ].join("\n");
}

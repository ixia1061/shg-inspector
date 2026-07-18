"use client";

import { LabelCard } from "@/components/admin/LabelCard";

export interface PrintLabel {
  url: string;
  code: string;
  location: string;
}

/**
 * 라벨 프린터용 인쇄 시트. 선택한 라벨을 지정한 크기(mm)로 "한 장에 하나씩" 인쇄한다.
 * 화면에서는 숨기고(QR은 미리 생성됨) 인쇄할 때만 표시된다. `@page`로 라벨 규격을 지정하므로
 * 라벨 프린터(Zebra 등)나 브라우저 PDF 저장에서 정확한 크기로 출력된다.
 */
export function PrintLabelSheet({
  labels,
  widthMm,
  heightMm,
  showLocation,
}: {
  labels: PrintLabel[];
  widthMm: number;
  heightMm: number;
  showLocation: boolean;
}) {
  const css = `
@media screen { #pl-sheet { display: none; } }
@media print {
  @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; }
  body * { visibility: hidden !important; }
  #pl-sheet, #pl-sheet * { visibility: visible !important; }
  #pl-sheet { position: absolute; left: 0; top: 0; }
  #pl-sheet .pl-label { break-after: page; page-break-after: always; }
  #pl-sheet .pl-label:last-child { break-after: auto; page-break-after: auto; }
}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="pl-sheet">
        {labels.map((l, i) => (
          <div key={`${l.code}-${i}`} className="pl-label">
            <LabelCard
              url={l.url}
              code={l.code}
              location={l.location}
              widthMm={widthMm}
              heightMm={heightMm}
              showLocation={showLocation}
            />
          </div>
        ))}
      </div>
    </>
  );
}

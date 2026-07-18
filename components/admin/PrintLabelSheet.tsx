"use client";

/* eslint-disable @next/next/no-img-element */

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export interface PrintLabel {
  url: string;
  code: string;
  location: string;
}

function LabelQr({ url }: { url: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 400, margin: 0 })
      .then((d) => {
        if (alive) setSrc(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? <img className="pl-qr" src={src} alt="" /> : <div className="pl-qr" />;
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
  const qrSize = Math.max(heightMm - 4, 8);
  const codeSize = Math.min(heightMm / 9, 4).toFixed(1);
  const locSize = Math.min(heightMm / 13, 2.6).toFixed(1);

  const css = `
@media screen { #pl-sheet { display: none; } }
@media print {
  @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; }
  body * { visibility: hidden !important; }
  #pl-sheet, #pl-sheet * { visibility: visible !important; }
  #pl-sheet { position: absolute; left: 0; top: 0; }
  #pl-sheet .pl-label {
    width: ${widthMm}mm; height: ${heightMm}mm;
    display: flex; align-items: center; gap: 1.5mm;
    padding: 1.5mm; box-sizing: border-box; overflow: hidden;
    break-after: page; page-break-after: always;
  }
  #pl-sheet .pl-label:last-child { break-after: auto; page-break-after: auto; }
  #pl-sheet .pl-qr { width: ${qrSize}mm; height: ${qrSize}mm; flex: 0 0 auto; }
  #pl-sheet .pl-text { flex: 1 1 auto; min-width: 0; }
  #pl-sheet .pl-code { font-family: monospace; font-weight: 700; font-size: ${codeSize}mm; line-height: 1.1; word-break: break-all; }
  #pl-sheet .pl-loc { font-size: ${locSize}mm; line-height: 1.1; margin-top: 0.8mm; color: #222; }
}
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="pl-sheet">
        {labels.map((l, i) => (
          <div key={`${l.code}-${i}`} className="pl-label">
            <LabelQr url={l.url} />
            <div className="pl-text">
              <div className="pl-code">{l.code}</div>
              {showLocation && l.location ? <div className="pl-loc">{l.location}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

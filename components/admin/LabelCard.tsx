"use client";

/* eslint-disable @next/next/no-img-element */

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * 라벨 한 장의 시각적 배치 (미리보기·인쇄 공용). 크기를 mm로 받아 실제 라벨 비율로 렌더한다.
 * 배치: QR(위) → 관리번호(굵게) → 위치(작게, 최대 2줄) 를 세로 가운데 정렬한다.
 */
export function LabelCard({
  url,
  code,
  location,
  widthMm,
  heightMm,
  showLocation,
}: {
  url: string;
  code: string;
  location: string;
  widthMm: number;
  heightMm: number;
  showLocation: boolean;
}) {
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

  const pad = Math.max(heightMm * 0.06, 1.2);
  const codeMm = Math.min(heightMm / 7.5, 4.2);
  const locMm = Math.min(heightMm / 11, 2.6);
  const gap = Math.max(heightMm * 0.03, 0.5);

  // 텍스트가 차지할 높이를 빼고 남는 공간에 QR을 넣어(가로도 넘지 않게) 세로 배치가 잘리지 않도록 한다.
  const codeH = codeMm * 1.3;
  const locH = showLocation ? locMm * 1.3 * 2 : 0;
  const gapCount = showLocation ? 2 : 1;
  const reserved = pad * 2 + codeH + locH + gap * gapCount;
  const qr = Math.max(Math.min(heightMm - reserved, widthMm - pad * 2), 6);

  return (
    <div
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: `${gap}mm`,
        padding: `${pad}mm`,
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#fff",
        textAlign: "center",
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: `${qr}mm`, height: `${qr}mm` }} />
      ) : (
        <div style={{ width: `${qr}mm`, height: `${qr}mm` }} />
      )}
      <div
        style={{
          fontFamily: "ui-monospace, monospace",
          fontWeight: 700,
          fontSize: `${codeMm}mm`,
          lineHeight: 1.15,
          color: "#000",
          maxWidth: "100%",
          overflowWrap: "anywhere",
        }}
      >
        {code}
      </div>
      {showLocation && location ? (
        <div
          style={{
            fontSize: `${locMm}mm`,
            lineHeight: 1.2,
            color: "#555",
            maxWidth: "100%",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {location}
        </div>
      ) : null}
    </div>
  );
}

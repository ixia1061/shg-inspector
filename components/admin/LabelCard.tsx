"use client";

/* eslint-disable @next/next/no-img-element */

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * 라벨 한 장의 시각적 배치 (미리보기·인쇄 공용). 크기를 mm로 받아 실제 라벨 비율로 렌더한다.
 * QR은 왼쪽, 관리번호(굵게)와 위치(작게)는 오른쪽에 세로 가운데 정렬한다.
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

  const pad = Math.max(heightMm * 0.08, 1.5);
  const qr = Math.max(Math.min(heightMm - pad * 2, widthMm * 0.42), 8);
  const codeMm = Math.min(heightMm / 7.5, 4.4);
  const locMm = Math.min(heightMm / 12, 2.8);

  return (
    <div
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        display: "flex",
        alignItems: "center",
        gap: `${pad}mm`,
        padding: `${pad}mm`,
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: `${qr}mm`, height: `${qr}mm`, flex: "0 0 auto" }} />
      ) : (
        <div style={{ width: `${qr}mm`, height: `${qr}mm`, flex: "0 0 auto" }} />
      )}
      <div
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: `${Math.max(heightMm * 0.03, 0.5)}mm`,
        }}
      >
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            fontWeight: 700,
            fontSize: `${codeMm}mm`,
            lineHeight: 1.15,
            color: "#000",
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
              color: "#444",
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
    </div>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element */

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** 인쇄용 QR 라벨 한 장 (QR 이미지 + 관리번호 + 위치). */
export function QrLabelCard({
  url,
  code,
  location,
}: {
  url: string;
  code: string;
  location: string;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 240, margin: 1 })
      .then((dataUrl) => {
        if (alive) setSrc(dataUrl);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className="qr-label flex flex-col items-center gap-1 rounded-lg border p-3 text-center">
      {src ? (
        <img src={src} alt={code} className="size-[150px]" width={150} height={150} />
      ) : (
        <div className="size-[150px]" />
      )}
      <p className="font-mono text-sm font-bold">{code}</p>
      <p className="text-muted-foreground text-xs">{location}</p>
    </div>
  );
}

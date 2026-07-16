"use client";

import { useEffect, useRef, useState } from "react";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export function QRScanner({ onScan }: { onScan: (decodedText: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            onScan(decodedText);
          },
          undefined
        );
      } catch {
        if (!cancelled) {
          setError("카메라를 시작할 수 없습니다. 카메라 권한을 확인해주세요.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id={SCANNER_ELEMENT_ID}
        className="w-full max-w-sm overflow-hidden rounded-lg [&_video]:rounded-lg"
      />
      {error && <p className="text-destructive px-4 text-center text-sm">{error}</p>}
    </div>
  );
}

"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { buildZpl } from "@/lib/qr/labelTemplate";
import { isZebraBrowserPrintAvailable, printZpl } from "@/lib/qr/zebraPrint";

export function QrLabelPreview({
  url,
  code,
  location,
}: {
  url: string;
  code: string;
  location: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zebraAvailable, setZebraAvailable] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1 });
    }
  }, [url]);

  useEffect(() => {
    // Zebra BrowserPrint 유틸리티 설치 여부는 브라우저 전역(window)에서만 확인 가능하므로
    // 마운트 이후에 판별해서 반영해야 한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZebraAvailable(isZebraBrowserPrintAvailable());
  }, []);

  async function handleZebraPrint() {
    setPrinting(true);
    try {
      await printZpl(buildZpl({ url, code, location }));
      toast.success("Zebra 프린터로 인쇄를 전송했습니다");
    } catch (err) {
      toast.error("Zebra 프린터 인쇄에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div id="print-area" className="flex flex-col items-center gap-2 rounded-lg border p-6">
        <canvas ref={canvasRef} />
        <p className="text-lg font-bold">{code}</p>
        <p className="text-muted-foreground text-sm">{location}</p>
      </div>

      <div className="flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>PDF로 인쇄 (브라우저 인쇄)</Button>
        <Button variant="outline" onClick={handleZebraPrint} disabled={!zebraAvailable || printing}>
          {printing ? "전송 중..." : "Zebra 프린터로 인쇄"}
        </Button>
      </div>
      {!zebraAvailable && (
        <p className="text-muted-foreground max-w-sm text-center text-xs print:hidden">
          Zebra 프린터로 바로 인쇄하려면 관리자 PC에 Zebra Browser Print 유틸리티를 설치해야 합니다.
          설치 전에는 &quot;PDF로 인쇄&quot;로 라벨 시트를 출력할 수 있습니다.
        </p>
      )}
    </div>
  );
}

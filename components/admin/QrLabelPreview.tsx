"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import { DEFAULT_LABEL_SIZE, LabelSizeControls } from "@/components/admin/LabelSizeControls";
import { PrintLabelSheet } from "@/components/admin/PrintLabelSheet";
import { Button } from "@/components/ui/button";

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
  const [labelSize, setLabelSize] = useState(DEFAULT_LABEL_SIZE);

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, url, { width: 150, margin: 1 });
    }
  }, [url]);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      {/* 화면 미리보기 + 크기 옵션 (인쇄물에서는 숨김) */}
      <div className="flex w-full flex-col items-center gap-4 print:hidden">
        <div className="flex flex-col items-center gap-2 rounded-lg border p-6">
          <canvas ref={canvasRef} />
          <p className="font-mono text-lg font-bold">{code}</p>
          {labelSize.showLocation && <p className="text-muted-foreground text-sm">{location}</p>}
        </div>

        <div className="w-full">
          <LabelSizeControls onChange={setLabelSize} />
        </div>

        <Button onClick={() => window.print()} className="w-full">
          인쇄 ({labelSize.widthMm}×{labelSize.heightMm}mm)
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          미리보기는 화면용이고, 실제 인쇄는 위에서 고른 라벨 크기로 한 장 출력됩니다. 라벨
          프린터를 기본(또는 인쇄 대상) 프린터로 선택하세요.
        </p>
      </div>

      {/* 인쇄 영역 (지정 크기 한 장) */}
      <PrintLabelSheet
        labels={[{ url, code, location }]}
        widthMm={labelSize.widthMm}
        heightMm={labelSize.heightMm}
        showLocation={labelSize.showLocation}
      />
    </div>
  );
}

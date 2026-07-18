"use client";

import { useState } from "react";

import { LabelCard } from "@/components/admin/LabelCard";
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
  const [labelSize, setLabelSize] = useState(DEFAULT_LABEL_SIZE);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      {/* 화면 미리보기 + 크기 옵션 (인쇄물에서는 숨김) */}
      <div className="flex w-full flex-col items-center gap-4 print:hidden">
        <div className="flex flex-col items-center gap-2">
          <p className="text-muted-foreground text-xs">실제 라벨 미리보기</p>
          <div className="inline-block rounded-md border bg-white p-1 shadow-sm">
            <LabelCard
              url={url}
              code={code}
              location={location}
              widthMm={labelSize.widthMm}
              heightMm={labelSize.heightMm}
              showLocation={labelSize.showLocation}
            />
          </div>
        </div>

        <div className="w-full">
          <LabelSizeControls onChange={setLabelSize} />
        </div>

        <Button onClick={() => window.print()} className="w-full">
          인쇄 ({labelSize.widthMm}×{labelSize.heightMm}mm)
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          위 미리보기 그대로 라벨 한 장이 출력됩니다. 라벨 프린터를 인쇄 대상으로 선택하세요.
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

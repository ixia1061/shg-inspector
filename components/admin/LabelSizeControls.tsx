"use client";

import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface LabelSize {
  widthMm: number;
  heightMm: number;
  showLocation: boolean;
}

export const DEFAULT_LABEL_SIZE: LabelSize = { widthMm: 50, heightMm: 30, showLocation: true };

// 라벨(스티커) 크기 프리셋. 값은 mm. Zebra 등 라벨 프린터의 실제 규격에 맞춘다.
const SIZE_PRESETS = [
  { value: "50x30", label: "50 × 30 mm", w: 50, h: 30 },
  { value: "40x30", label: "40 × 30 mm", w: 40, h: 30 },
  { value: "60x40", label: "60 × 40 mm", w: 60, h: 40 },
  { value: "30x20", label: "30 × 20 mm", w: 30, h: 20 },
  { value: "custom", label: "직접 지정", w: 0, h: 0 },
];

/** 라벨 크기/위치표시 옵션 컨트롤. 값이 바뀔 때마다 onChange로 알린다(QR 라벨 인쇄 공용). */
export function LabelSizeControls({ onChange }: { onChange: (v: LabelSize) => void }) {
  const [sizeKey, setSizeKey] = useState("50x30");
  const [customW, setCustomW] = useState(50);
  const [customH, setCustomH] = useState(30);
  const [showLocation, setShowLocation] = useState(true);

  const preset = SIZE_PRESETS.find((p) => p.value === sizeKey) ?? SIZE_PRESETS[0];
  const widthMm = sizeKey === "custom" ? customW : preset.w;
  const heightMm = sizeKey === "custom" ? customH : preset.h;

  useEffect(() => {
    onChange({ widthMm, heightMm, showLocation });
  }, [widthMm, heightMm, showLocation, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
      <span className="text-muted-foreground text-sm">라벨 크기</span>
      <Select items={SIZE_PRESETS} value={sizeKey} onValueChange={(v) => setSizeKey(v ?? "50x30")}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="라벨 크기" />
        </SelectTrigger>
        <SelectContent>
          {SIZE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {sizeKey === "custom" && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={10}
            value={customW}
            onChange={(e) => setCustomW(Number(e.target.value) || 0)}
            className="w-20"
            aria-label="라벨 가로(mm)"
          />
          <span className="text-sm">×</span>
          <Input
            type="number"
            min={10}
            value={customH}
            onChange={(e) => setCustomH(Number(e.target.value) || 0)}
            className="w-20"
            aria-label="라벨 세로(mm)"
          />
          <span className="text-muted-foreground text-sm">mm</span>
        </div>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
        <Checkbox checked={showLocation} onCheckedChange={(c) => setShowLocation(c === true)} />
        위치 표시
      </label>
      <span className="text-muted-foreground ml-auto text-xs">
        현재 {widthMm}×{heightMm}mm · 한 장에 하나씩 출력
      </span>
    </div>
  );
}

"use client";

import { CalendarIcon } from "lucide-react";
import { useRef } from "react";

import { Input } from "@/components/ui/input";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/**
 * 연·월만 입력하는 필드. 소화기 명판에 제조년월(예: 2026.12)까지만 찍혀 있어
 * 일(day)은 받지 않고 저장 시 해당 월 1일로 처리한다.
 * - 숫자만 연속 입력해도 자동으로 YYYY-MM 형식이 된다 (202612 → 2026-12)
 * - 오른쪽 아이콘을 누르면 브라우저 기본 월 선택기가 열린다
 */
export function MonthInput({
  id,
  value,
  onChange,
  placeholder = "YYYY-MM (예: 2026-12, 숫자만 입력해도 됩니다)",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function handleTextChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    onChange(formatted);
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") {
      picker.showPicker();
    } else {
      picker.focus();
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        className="pr-9"
      />
      <button
        type="button"
        aria-label="달력에서 연·월 선택"
        onClick={openPicker}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
      >
        <CalendarIcon className="size-4" />
      </button>
      {/* 월 선택용 숨김 input — 텍스트 입력과 양방향 동기화 */}
      <input
        ref={pickerRef}
        type="month"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-0 size-0 opacity-0"
        value={MONTH_PATTERN.test(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

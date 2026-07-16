"use client";

import { CalendarIcon } from "lucide-react";
import { useRef } from "react";

import { Input } from "@/components/ui/input";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 타이핑과 달력을 모두 지원하는 날짜 입력.
 * - 숫자만 연속으로 입력해도 자동으로 YYYY-MM-DD 형식으로 하이픈이 붙는다 (20240115 → 2024-01-15)
 * - 오른쪽 달력 아이콘을 누르면 브라우저 기본 날짜 선택기가 열린다
 */
export function DateInput({
  id,
  value,
  onChange,
  placeholder = "YYYY-MM-DD (숫자만 입력해도 됩니다)",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);

  function handleTextChange(raw: string) {
    // 하이픈 등 비숫자를 제거한 뒤 YYYY-MM-DD로 재조립 (지우는 중에도 자연스럽게 동작)
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 6) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 4) {
      formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    onChange(formatted);
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    // showPicker는 Chrome/Edge/Android에서 지원. 미지원 브라우저는 타이핑으로 입력한다.
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
        aria-label="달력에서 날짜 선택"
        onClick={openPicker}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
      >
        <CalendarIcon className="size-4" />
      </button>
      {/* 달력 선택용 숨김 date input — 값은 텍스트 입력과 양방향 동기화 */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-0 size-0 opacity-0"
        value={DATE_PATTERN.test(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

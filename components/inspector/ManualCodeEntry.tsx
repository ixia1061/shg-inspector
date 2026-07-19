"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * QR이 손상·오염되어 스캔이 안 될 때, 소화기 라벨에 인쇄된 관리번호를 직접 입력해
 * 점검을 시작한다. onSubmit에는 스캔과 동일한 처리(스캔 통행증 발급 + 점검 화면 이동)를
 * 넘겨 스캔한 것과 똑같이 동작하게 한다.
 */
export function ManualCodeEntry({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  function submit() {
    const trimmed = code.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-4" /> QR이 손상됐나요? 관리번호 직접 입력
      </Button>
    );
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <p className="text-muted-foreground text-left text-sm">
        소화기 라벨의 관리번호를 입력하세요 (예: 공사-1-1-1)
      </p>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="관리번호 입력"
        autoFocus
        inputMode="text"
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <div className="flex gap-2">
        <Button className="h-12 flex-1" onClick={submit} disabled={!code.trim()}>
          점검 시작
        </Button>
        <Button
          variant="outline"
          className="h-12"
          onClick={() => {
            setOpen(false);
            setCode("");
          }}
        >
          취소
        </Button>
      </div>
    </div>
  );
}

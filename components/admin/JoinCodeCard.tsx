"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { issueJoinCodeAction } from "@/app/(admin)/users/actions";
import { Button } from "@/components/ui/button";

/** 0/O, 1/I 처럼 헷갈리는 글자를 뺀 32자 — 현장에서 구두로 전달하기 쉽게. */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
/** 4자리(약 105만 조합). 짧은 만큼 무작위 대입은 가입 액션의 시도 제한으로 막는다. */
const CODE_LENGTH = 4;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/**
 * 관리자 가입코드 — 점검자가 /signup에서 이 코드로 신청하면 그 관리자에게 접수된다.
 * 관리자는 자기 코드를 보고 복사만 하고, 발급·재발급은 시스템관리자만 한다.
 */
export function JoinCodeCard({
  adminId,
  code,
  canIssue,
}: {
  adminId: string;
  code: string | null;
  /** 발급·재발급 가능 여부(시스템관리자만) */
  canIssue: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function issue() {
    if (code && !confirm("새 코드를 발급하면 지금 코드는 즉시 사용할 수 없습니다. 계속할까요?")) {
      return;
    }
    setSaving(true);
    try {
      await issueJoinCodeAction(adminId, generateCode());
      toast.success(code ? "가입코드를 재발급했습니다" : "가입코드를 발급했습니다");
      router.refresh();
    } catch (err) {
      toast.error("가입코드 발급에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사하지 못했습니다. 코드를 직접 입력해 주세요.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {code ? (
        <>
          <span className="bg-muted rounded px-3 py-1.5 font-mono text-lg tracking-widest">
            {code}
          </span>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "복사됨" : "복사"}
          </Button>
          {canIssue && (
            <Button variant="outline" size="sm" onClick={issue} disabled={saving}>
              <RefreshCw className="size-4" />
              {saving ? "발급 중..." : "재발급"}
            </Button>
          )}
        </>
      ) : canIssue ? (
        <>
          <span className="text-muted-foreground text-sm">코드 없음</span>
          <Button variant="outline" size="sm" onClick={issue} disabled={saving}>
            {saving ? "발급 중..." : "가입코드 발급"}
          </Button>
        </>
      ) : (
        <span className="text-muted-foreground text-sm">
          아직 가입코드가 없습니다. 시스템관리자에게 발급을 요청하세요.
        </span>
      )}
    </div>
  );
}

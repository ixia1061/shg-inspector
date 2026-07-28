"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resetPasswordAction } from "@/app/(admin)/users/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 비밀번호를 잊은 계정에 임시 비밀번호를 발급한다.
 * 이메일 재설정 링크는 SMTP가 있어야 해서, 관리자가 임시 비밀번호를 전달하고
 * 받은 사람이 "내 계정"에서 직접 바꾸는 방식으로 둔다.
 * 발급된 값은 **이 창에서 한 번만** 보이므로 닫기 전에 복사해야 한다.
 */
export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleReset() {
    if (
      !confirm(
        `"${userName}" 님의 비밀번호를 새로 발급하시겠습니까?\n\n지금 쓰던 비밀번호는 즉시 사용할 수 없게 됩니다.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const { password: next } = await resetPasswordAction(userId);
        setPassword(next);
      } catch (err) {
        toast.error("비밀번호 재설정에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사하지 못했습니다. 화면의 값을 직접 적어 주세요.");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleReset} disabled={isPending}>
        <KeyRound className="size-4" />
        {isPending ? "발급 중..." : "비밀번호"}
      </Button>

      <Dialog open={password !== null} onOpenChange={(open) => !open && setPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{userName} 님 임시 비밀번호</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-muted flex-1 rounded px-3 py-2 font-mono text-lg tracking-wider">
                {password}
              </span>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "복사됨" : "복사"}
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              이 값은 <b>지금 한 번만</b> 보입니다. 창을 닫기 전에 복사해서 본인에게 전달하세요.
              받은 사람은 로그인한 뒤 <b>내 계정</b>에서 비밀번호를 바꾸면 됩니다.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={() => setPassword(null)}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

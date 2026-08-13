"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAffiliationAction } from "@/app/(admin)/users/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * 소속(부서·업체) 수정.
 * 가입할 때 신청자가 직접 적은 값이라 오타가 있거나 부서가 바뀔 수 있어 관리자가 고친다.
 */
export function AffiliationDialog({
  userId,
  userName,
  affiliation,
}: {
  userId: string;
  userName: string;
  affiliation: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(affiliation ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateAffiliationAction(userId, value);
        toast.success("소속을 수정했습니다");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("소속 수정에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // 취소하고 다시 열면 저장된 값에서 시작한다.
        if (!next) setValue(affiliation ?? "");
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-muted-foreground h-6 px-1" title="소속 수정" />
        }
      >
        <Pencil className="size-3" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{userName} 님 소속 수정</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="affiliation-input">소속</FieldLabel>
          <Input
            id="affiliation-input"
            value={value}
            placeholder="예: 한국공항공사"
            maxLength={50}
            onChange={(e) => setValue(e.target.value)}
          />
          <FieldDescription>
            점검 범위를 정할 때 참고하는 값입니다. 권한에는 영향을 주지 않습니다.
          </FieldDescription>
        </Field>
        <DialogFooter className="mt-4">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

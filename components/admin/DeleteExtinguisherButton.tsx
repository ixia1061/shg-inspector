"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteExtinguisherAction } from "@/app/actions/extinguisherActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * 폐기·철수 소화기를 완전 삭제하는 버튼(관리자 전용).
 * 되돌릴 수 없고 점검이력·사진까지 함께 지워지므로,
 * 관리번호를 정확히 입력해야 삭제가 활성화된다.
 */
export function DeleteExtinguisherButton({
  id,
  assetCode,
  hasHistory,
}: {
  id: string;
  assetCode: string;
  hasHistory: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const matched = confirmText.trim() === assetCode;

  async function handleDelete() {
    if (!matched) return;
    setDeleting(true);
    try {
      const res = await deleteExtinguisherAction(id);
      toast.success(`${res.asset_code} 소화기를 삭제했습니다`);
      setOpen(false);
      router.push("/extinguishers");
      router.refresh();
    } catch (err) {
      toast.error("삭제에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="text-destructive hover:text-destructive" />}>
        <Trash2 className="size-4" /> 삭제
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono">{assetCode}</span> 소화기 삭제
          </DialogTitle>
          <DialogDescription>
            폐기·철수한 소화기를 관리대장에서 완전히 삭제합니다. 이 작업은 <b>되돌릴 수 없습니다.</b>
            {hasHistory ? " 이 소화기의 점검 이력과 사진도 함께 영구 삭제됩니다." : ""}
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="del-confirm">
            삭제하려면 관리번호 <span className="font-mono font-medium">{assetCode}</span> 를 입력하세요
          </FieldLabel>
          <Input
            id="del-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={assetCode}
            autoComplete="off"
          />
        </Field>

        <DialogFooter className="mt-4" showCloseButton>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!matched || deleting}
          >
            {deleting ? "삭제 중..." : "완전 삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

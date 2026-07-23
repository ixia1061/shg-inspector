"use client";

import { Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { resolveInspectionAction } from "@/app/actions/inspectionActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { defectItemsText } from "@/lib/utils/inspection";
import type { ExtinguisherOverview } from "@/types/domain";

/**
 * 이상으로 기록된 소화기의 조치내용을 입력하고 조치완료 처리하는 관리자 다이얼로그.
 * 조치완료하면 그 소화기가 이번달 점검완료로 집계된다.
 */
export function ResolveActionDialog({ extinguisher }: { extinguisher: ExtinguisherOverview }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const defects = defectItemsText(extinguisher);

  async function handleResolve() {
    if (!extinguisher.last_inspection_id) {
      toast.error("점검 정보를 찾을 수 없습니다");
      return;
    }
    setSubmitting(true);
    try {
      await resolveInspectionAction({
        inspectionId: extinguisher.last_inspection_id,
        extinguisherId: extinguisher.id,
        note,
      });
      toast.success("조치완료 처리되었습니다");
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error("조치 처리에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNote("");
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Wrench className="size-4" /> 조치
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono">{extinguisher.asset_code}</span> 조치
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">불량항목: </span>
            <span className="text-destructive font-medium">{defects || "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">불량내용: </span>
            <span>{extinguisher.last_inspection_memo || "-"}</span>
          </div>
        </div>

        <FieldGroup className="mt-2">
          <Field>
            <FieldLabel htmlFor="action-note">조치내용</FieldLabel>
            <Textarea
              id="action-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 노즐 교체 완료, 재충전 등 조치한 내용을 입력하세요"
            />
          </Field>
        </FieldGroup>

        <DialogFooter className="mt-4">
          <Button onClick={handleResolve} disabled={submitting || !note.trim()}>
            {submitting ? "처리 중..." : "조치완료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

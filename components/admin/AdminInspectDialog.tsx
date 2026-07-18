"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { trimExtinguisherPhotosAction } from "@/app/actions/photoActions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { createClient } from "@/lib/supabase/client";
import { watermarkImage } from "@/lib/utils/watermark";
import { computeOverallResult } from "@/lib/validations/inspection.schema";
import type { ExtinguisherOverview } from "@/types/domain";

const CHECK_ITEMS = [
  { key: "pressure_ok", label: "압력 정상" },
  { key: "seal_ok", label: "봉인 정상" },
  { key: "appearance_ok", label: "외관 정상" },
  { key: "installation_ok", label: "설치상태 정상" },
] as const;

const MAX_PHOTOS = 5;

type Checks = Record<(typeof CHECK_ITEMS)[number]["key"], boolean>;
const ALL_OK: Checks = {
  pressure_ok: true,
  seal_ok: true,
  appearance_ok: true,
  installation_ok: true,
};

/**
 * 관리자가 QR 스캔 없이 관리자 화면 안에서 바로 점검을 완료하는 모달.
 * 점검자 화면으로 이동하지 않고 그 자리에서 처리한다. (관리자는 PC/온라인 전제 → 온라인 저장)
 */
export function AdminInspectDialog({
  extinguisher,
  variant = "row",
}: {
  // 점검 저장에는 id·asset_code만 필요하므로, 경량 목록 뷰(ExtinguisherListItem)에서도 쓸 수 있게 좁힌다.
  extinguisher: Pick<ExtinguisherOverview, "id" | "asset_code">;
  variant?: "row" | "detail";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checks, setChecks] = useState<Checks>(ALL_OK);
  const [memo, setMemo] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  function reset() {
    setChecks(ALL_OK);
    setMemo("");
    setFiles([]);
  }

  async function handleFiles(selected: File[]) {
    if (!selected.length) return;
    // 기존 사진에 "추가"한다 (조치 전·후). 최대 장수까지만.
    const room = MAX_PHOTOS - files.length;
    if (room <= 0) {
      toast.warning(`사진은 최대 ${MAX_PHOTOS}장까지 첨부됩니다`);
      return;
    }
    const use = selected.slice(0, room);
    if (selected.length > room) {
      toast.warning(`사진은 최대 ${MAX_PHOTOS}장까지 첨부됩니다`, {
        description: `${use.length}장만 추가했습니다.`,
      });
    }
    setProcessing(true);
    try {
      // 사진 하단 중앙에 관리번호 워터마크
      const stamped = await Promise.all(use.map((f) => watermarkImage(f, [extinguisher.asset_code])));
      setFiles((prev) => [...prev, ...stamped]);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    const overall_result = computeOverallResult(checks);
    const inspected_at = new Date().toISOString();
    try {
      const supabase = createClient();
      const photo_paths: string[] = [];
      for (const f of files) {
        const path = `${extinguisher.id}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage
          .from("inspection-photos")
          .upload(path, f, { upsert: true });
        if (upErr) throw upErr;
        photo_paths.push(path);
      }

      const { error } = await supabase.rpc("fn_submit_inspection", {
        p_payload: {
          extinguisher_id: extinguisher.id,
          pressure_ok: checks.pressure_ok,
          seal_ok: checks.seal_ok,
          appearance_ok: checks.appearance_ok,
          installation_ok: checks.installation_ok,
          overall_result,
          memo: memo || null,
          inspected_at,
          photo_paths,
        },
      });
      if (error) throw error;

      if (photo_paths.length > 0) {
        void trimExtinguisherPhotosAction(extinguisher.id).catch(() => {});
      }

      toast.success(
        overall_result === "abnormal"
          ? "이상사항으로 점검이 기록되었습니다"
          : "점검이 완료되었습니다"
      );
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error("점검 저장에 실패했습니다", {
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
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          variant === "detail" ? (
            <Button variant="outline" />
          ) : (
            <Button variant="ghost" size="sm" />
          )
        }
      >
        <ClipboardCheck className="size-4" /> 점검
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono">{extinguisher.asset_code}</span> 점검
          </DialogTitle>
        </DialogHeader>

        <FieldGroup>
          {CHECK_ITEMS.map(({ key, label }) => (
            <Field key={key} orientation="horizontal">
              <Checkbox
                id={`ai-${key}`}
                checked={checks[key]}
                onCheckedChange={(c) => setChecks((prev) => ({ ...prev, [key]: c === true }))}
              />
              <FieldLabel htmlFor={`ai-${key}`}>{label}</FieldLabel>
            </Field>
          ))}
          <Field>
            <FieldLabel htmlFor="ai-memo">비고 (선택)</FieldLabel>
            <Textarea
              id="ai-memo"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="이상사항이 있으면 입력하세요"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ai-photos">
              사진 (선택, 최대 {MAX_PHOTOS}장 · 조치 전·후)
            </FieldLabel>
            <input
              id="ai-photos"
              type="file"
              accept="image/*"
              multiple
              className="text-sm"
              disabled={files.length >= MAX_PHOTOS}
              onChange={(e) => {
                // 다시 선택해도 추가되도록 입력값을 비운다(누적)
                void handleFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            {processing && (
              <p className="text-muted-foreground text-xs">사진에 관리번호를 새기는 중...</p>
            )}
            {files.length > 0 && !processing && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {files.length}/{MAX_PHOTOS}장 첨부됨
                </span>
                <button
                  type="button"
                  className="text-muted-foreground text-xs underline"
                  onClick={() => setFiles([])}
                >
                  모두 지우기
                </button>
              </div>
            )}
          </Field>
        </FieldGroup>

        <DialogFooter className="mt-4">
          <Button onClick={handleSubmit} disabled={submitting || processing}>
            {submitting ? "저장 중..." : "점검완료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

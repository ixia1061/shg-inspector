"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LIFECYCLE_STATUS_LABEL } from "@/lib/utils/lifecycle";
import { formatLocationPath } from "@/lib/utils/location";
import { enqueueInspection } from "@/lib/offline/outbox";
import { flushOutbox } from "@/lib/offline/syncEngine";
import { createClient } from "@/lib/supabase/client";
import { computeOverallResult } from "@/lib/validations/inspection.schema";
import type { ExtinguisherOverview } from "@/types/domain";

interface ChecklistValues {
  pressure_ok: boolean;
  seal_ok: boolean;
  appearance_ok: boolean;
  installation_ok: boolean;
  memo: string;
}

const CHECK_ITEMS: { key: keyof Omit<ChecklistValues, "memo">; label: string }[] = [
  { key: "pressure_ok", label: "압력 정상" },
  { key: "seal_ok", label: "봉인 정상" },
  { key: "appearance_ok", label: "외관 정상" },
  { key: "installation_ok", label: "설치상태 정상" },
];

export function InspectionChecklist({ extinguisher }: { extinguisher: ExtinguisherOverview }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);

  const { register, handleSubmit, watch, setValue } = useForm<ChecklistValues>({
    defaultValues: {
      pressure_ok: true,
      seal_ok: true,
      appearance_ok: true,
      installation_ok: true,
      memo: "",
    },
  });

  const values = watch();

  async function onSubmit(values: ChecklistValues) {
    setSubmitting(true);
    const overall_result = computeOverallResult(values);
    const inspected_at = new Date().toISOString();

    try {
      if (navigator.onLine) {
        const supabase = createClient();
        const photoPaths: string[] = [];

        for (const photo of photos) {
          const path = `${extinguisher.id}/${Date.now()}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from("inspection-photos")
            .upload(path, photo, { upsert: true });
          if (uploadError) throw uploadError;
          photoPaths.push(path);
        }

        const { error } = await supabase.rpc("fn_submit_inspection", {
          p_payload: {
            extinguisher_id: extinguisher.id,
            pressure_ok: values.pressure_ok,
            seal_ok: values.seal_ok,
            appearance_ok: values.appearance_ok,
            installation_ok: values.installation_ok,
            overall_result,
            memo: values.memo || null,
            inspected_at,
            photo_paths: photoPaths,
          },
        });
        if (error) throw error;
      } else {
        await enqueueInspection({
          extinguisher_id: extinguisher.id,
          pressure_ok: values.pressure_ok,
          seal_ok: values.seal_ok,
          appearance_ok: values.appearance_ok,
          installation_ok: values.installation_ok,
          overall_result,
          memo: values.memo || null,
          inspected_at,
          photos: photos.map((file) => ({ blob: file, fileName: file.name })),
        });
      }

      router.push(`/inspect/complete?result=${overall_result}`);
      void flushOutbox();
    } catch (err) {
      toast.error("점검 저장에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-6 p-4">
      <div className="rounded-lg border p-4">
        <p className="text-lg font-bold">{extinguisher.asset_code}</p>
        <p className="text-muted-foreground text-sm">{formatLocationPath(extinguisher)}</p>
        <p className="text-muted-foreground mt-2 text-sm">
          {extinguisher.extinguisher_type_name} · 제조일 {extinguisher.manufacture_date} ·{" "}
          {LIFECYCLE_STATUS_LABEL[extinguisher.lifecycle_status]}
        </p>
        <p className="text-muted-foreground text-sm">
          최근 점검:{" "}
          {extinguisher.last_inspected_at
            ? new Date(extinguisher.last_inspected_at).toLocaleDateString("ko-KR")
            : "이력 없음"}
        </p>
      </div>

      <FieldGroup>
        {CHECK_ITEMS.map(({ key, label }) => (
          <Field key={key} orientation="horizontal">
            <Checkbox
              id={key}
              className="size-6"
              checked={values[key]}
              onCheckedChange={(checked) => setValue(key, checked === true)}
            />
            <FieldLabel htmlFor={key} className="text-base">
              {label}
            </FieldLabel>
          </Field>
        ))}
        <Field>
          <FieldLabel htmlFor="memo">비고 (선택)</FieldLabel>
          <Textarea id="memo" rows={2} placeholder="이상사항이 있으면 입력하세요" {...register("memo")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="photos">사진 (선택)</FieldLabel>
          <input
            id="photos"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="text-sm"
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="mt-auto h-14 text-lg" disabled={submitting}>
        {submitting ? "저장 중..." : "점검완료"}
      </Button>
    </form>
  );
}

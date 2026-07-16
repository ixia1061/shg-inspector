"use client";

/* eslint-disable @next/next/no-img-element */

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LIFECYCLE_STATUS_LABEL } from "@/lib/utils/lifecycle";
import { formatLocationPath } from "@/lib/utils/location";
import { watermarkImage } from "@/lib/utils/watermark";
import { trimExtinguisherPhotosAction } from "@/app/actions/photoActions";
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

interface StampedPhoto {
  file: File;
  previewUrl: string;
}

const CHECK_ITEMS: { key: keyof Omit<ChecklistValues, "memo">; label: string }[] = [
  { key: "pressure_ok", label: "압력 정상" },
  { key: "seal_ok", label: "봉인 정상" },
  { key: "appearance_ok", label: "외관 정상" },
  { key: "installation_ok", label: "설치상태 정상" },
];

/** 점검 1회당 첨부 가능한 사진 수 (전·후 사진 등) */
const MAX_INSPECTION_PHOTOS = 5;

export function InspectionChecklist({ extinguisher }: { extinguisher: ExtinguisherOverview }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<StampedPhoto[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);

  // 언마운트 시 미리보기 URL 해제를 위한 최신 상태 참조
  const photosRef = useRef<StampedPhoto[]>([]);
  photosRef.current = photos;
  useEffect(() => {
    return () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }, []);

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

  async function handlePhotosSelected(files: File[]) {
    if (!files.length) return;
    if (files.length > MAX_INSPECTION_PHOTOS) {
      toast.warning(`사진은 최대 ${MAX_INSPECTION_PHOTOS}장까지 첨부할 수 있습니다`, {
        description: `앞의 ${MAX_INSPECTION_PHOTOS}장만 사용됩니다.`,
      });
      files = files.slice(0, MAX_INSPECTION_PHOTOS);
    }
    setProcessingPhotos(true);
    try {
      // 사진 하단에 관리번호 워터마크를 새긴다
      const stampLines = [extinguisher.asset_code];
      const stamped = await Promise.all(files.map((f) => watermarkImage(f, stampLines)));
      setPhotos((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return stamped.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
      });
    } finally {
      setProcessingPhotos(false);
    }
  }

  /** 워터마크가 새겨진 사진을 휴대폰에 저장 (iOS: 공유 시트 → '이미지 저장') */
  async function savePhotosToDevice() {
    const files = photos.map((p) => p.file);
    if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
      try {
        await navigator.share({ files });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return; // 사용자가 취소
      }
    }
    // 공유 미지원 브라우저: 개별 다운로드로 폴백
    for (const photo of photos) {
      const a = document.createElement("a");
      a.href = photo.previewUrl;
      a.download = photo.file.name;
      a.click();
    }
  }

  async function onSubmit(values: ChecklistValues) {
    setSubmitting(true);
    const overall_result = computeOverallResult(values);
    const inspected_at = new Date().toISOString();

    try {
      if (navigator.onLine) {
        const supabase = createClient();
        const photoPaths: string[] = [];

        for (const photo of photos) {
          const path = `${extinguisher.id}/${Date.now()}-${photo.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("inspection-photos")
            .upload(path, photo.file, { upsert: true });
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

        // 소화기당 최신 5장만 유지 (서버 용량 관리) — 실패해도 점검 저장에는 영향 없음
        if (photoPaths.length > 0) {
          void trimExtinguisherPhotosAction(extinguisher.id).catch(() => {});
        }
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
          photos: photos.map((p) => ({ blob: p.file, fileName: p.file.name })),
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
            onChange={(e) => void handlePhotosSelected(Array.from(e.target.files ?? []))}
          />
          {processingPhotos && (
            <p className="text-muted-foreground text-xs">사진에 관리번호를 새기는 중...</p>
          )}
          {photos.length > 0 && !processingPhotos && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {photos.map((photo) => (
                  <img
                    key={photo.previewUrl}
                    src={photo.previewUrl}
                    alt="점검 사진 미리보기"
                    className="size-20 rounded-md border object-cover"
                  />
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={savePhotosToDevice}>
                <Download className="size-4" /> 휴대폰에 저장
              </Button>
              <p className="text-muted-foreground text-xs">
                iPhone: 공유 메뉴에서 &quot;이미지 저장&quot;을 누르면 사진 앱에 저장됩니다.
              </p>
            </div>
          )}
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        size="lg"
        className="mt-auto h-14 text-lg"
        disabled={submitting || processingPhotos}
      >
        {submitting ? "저장 중..." : "점검완료"}
      </Button>
    </form>
  );
}

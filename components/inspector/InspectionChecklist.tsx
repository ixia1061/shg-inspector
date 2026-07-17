"use client";

/* eslint-disable @next/next/no-img-element */

import { CheckCircle2, Download, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LIFECYCLE_STATUS_LABEL } from "@/lib/utils/lifecycle";
import { formatShortLocation } from "@/lib/utils/location";
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
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<StampedPhoto[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  // 페이지 이동 대신 이 화면 안에서 완료 상태로 전환한다.
  // (개발/터널 환경에서 라우터 전환이 멈추는 문제 + 오프라인에서 완료 페이지 이동 실패 문제 방지)
  const [completed, setCompleted] = useState<"normal" | "abnormal" | null>(null);

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
    // 기존 사진을 유지하고 새로 찍은 사진을 "추가"한다 (전·후 사진). 최대 장수까지만.
    const room = MAX_INSPECTION_PHOTOS - photos.length;
    if (room <= 0) {
      toast.warning(`사진은 최대 ${MAX_INSPECTION_PHOTOS}장까지 첨부할 수 있습니다`);
      return;
    }
    const use = files.slice(0, room);
    if (files.length > room) {
      toast.warning(`사진은 최대 ${MAX_INSPECTION_PHOTOS}장까지 첨부할 수 있습니다`, {
        description: `${use.length}장만 추가했습니다.`,
      });
    }
    setProcessingPhotos(true);
    try {
      // 사진 하단에 관리번호 워터마크를 새긴다
      const stampLines = [extinguisher.asset_code];
      const stamped = await Promise.all(use.map((f) => watermarkImage(f, stampLines)));
      const added = stamped.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
      setPhotos((prev) => [...prev, ...added]);
    } finally {
      setProcessingPhotos(false);
    }
  }

  /** 첨부한 사진 한 장을 제거한다. */
  function removePhoto(index: number) {
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
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

      setCompleted(overall_result);
      void flushOutbox();
    } catch (err) {
      toast.error("점검 저장에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
        {completed === "abnormal" ? (
          <TriangleAlert className="text-destructive size-20" />
        ) : (
          <CheckCircle2 className="size-20 text-green-600" />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {completed === "abnormal" ? "이상사항이 기록되었습니다" : "점검이 완료되었습니다"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {extinguisher.asset_code} · 수고하셨습니다
          </p>
        </div>
        <Button
          size="lg"
          className="h-14 w-full max-w-xs text-lg"
          nativeButton={false}
          render={<Link href="/scan" />}
        >
          다음 소화기 스캔
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col gap-6 p-4">
      <div className="rounded-lg border p-4">
        <p className="text-lg font-bold">{extinguisher.asset_code}</p>
        <p className="text-muted-foreground text-sm">{formatShortLocation(extinguisher)}</p>
        <p className="text-muted-foreground mt-2 text-sm">
          {extinguisher.extinguisher_type_name}
          {extinguisher.capacity ? ` (${extinguisher.capacity})` : ""} · 제조일{" "}
          {extinguisher.manufacture_date} · {LIFECYCLE_STATUS_LABEL[extinguisher.lifecycle_status]}
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
          <FieldLabel htmlFor="photos">
            사진 (선택, 최대 {MAX_INSPECTION_PHOTOS}장 · 전·후 촬영){" "}
            {photos.length > 0 ? `— ${photos.length}/${MAX_INSPECTION_PHOTOS}` : ""}
          </FieldLabel>
          <input
            id="photos"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="text-sm"
            disabled={photos.length >= MAX_INSPECTION_PHOTOS}
            onChange={(e) => {
              // 같은 카메라로 다시 찍어도 onChange가 다시 발생하도록 입력값을 비운다(누적 촬영).
              void handlePhotosSelected(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          {processingPhotos && (
            <p className="text-muted-foreground text-xs">사진에 관리번호를 새기는 중...</p>
          )}
          {photos.length > 0 && !processingPhotos && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <div key={photo.previewUrl} className="relative">
                    <img
                      src={photo.previewUrl}
                      alt="점검 사진 미리보기"
                      className="size-20 rounded-md border object-cover"
                    />
                    <button
                      type="button"
                      aria-label="사진 삭제"
                      onClick={() => removePhoto(index)}
                      className="bg-destructive text-destructive-foreground absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full shadow"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                버튼을 다시 눌러 사진을 추가로 촬영할 수 있습니다(조치 전·후). 잘못 찍은 사진은
                우측 상단 ✕로 삭제하세요.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={savePhotosToDevice}>
                <Download className="size-4" /> 휴대폰에 저장
              </Button>
              <p className="text-muted-foreground text-xs">
                iPhone은 공유 메뉴에서 &quot;이미지 저장&quot;, Android는 공유 대상에서 갤러리(사진)를
                선택하면 저장됩니다.
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

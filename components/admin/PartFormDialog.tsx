"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/utils/supabaseError";
import { partSchema, type PartFormValues } from "@/lib/validations/part.schema";
import type { ManagementPart } from "@/types/domain";

/** 관리파트 추가/수정/삭제(시스템관리자). 코드는 관리번호 앞자리로 쓰인다. */
export function PartFormDialog({
  siteId,
  part,
  nextOrderIndex = 0,
}: {
  siteId: string;
  part?: ManagementPart;
  nextOrderIndex?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!part;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PartFormValues>({
    resolver: zodResolver(partSchema),
    defaultValues: { code: part?.code ?? "", name: part?.name ?? "" },
  });

  async function onSubmit(values: PartFormValues) {
    // 코드를 실제로 바꾸면 이 파트 소속 소화기의 관리번호가 일괄 재계산되므로,
    // QR 재출력 안내 후 한 번 더 확인받는다. (이름만 바꾸는 경우는 관리번호 불변이라 그냥 저장)
    if (part && values.code !== part.code) {
      const ok = confirm(
        `파트 코드를 '${part.code}' → '${values.code}'(으)로 변경하면\n` +
          `이 파트에 속한 모든 소화기의 관리번호가 '${values.code}-...'로 일괄 변경됩니다.\n\n` +
          `이미 부착된 QR 라벨을 다시 출력해야 합니다. 계속하시겠습니까?`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("management_parts").update(values).eq("id", part.id)
      : await supabase
          .from("management_parts")
          .insert({ ...values, site_id: siteId, order_index: nextOrderIndex });
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(isEdit ? "관리파트를 수정했습니다" : "관리파트를 추가했습니다");
    setOpen(false);
    reset(values);
    router.refresh();
  }

  async function handleDelete() {
    if (!part) return;
    if (!confirm(`관리파트 '${part.name}(${part.code})'를 삭제하시겠습니까?`)) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("management_parts").delete().eq("id", part.id);
    setSubmitting(false);

    if (error) {
      // 소속 소화기가 있으면 FK(on delete restrict)로 막힌다.
      toast.error("삭제에 실패했습니다", {
        description:
          friendlyErrorMessage(error) +
          " (소속 소화기가 있으면 삭제할 수 없습니다. 소화기를 다른 파트로 옮기거나 삭제하세요.)",
      });
      return;
    }

    toast.success("관리파트를 삭제했습니다");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>수정</DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Plus className="size-4" /> 관리파트 추가
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "관리파트 수정" : "관리파트 추가"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="part_code">파트 코드</FieldLabel>
              <Input id="part_code" placeholder="예: 공사, 소방, 전기" {...register("code")} />
              <FieldError errors={errors.code ? [errors.code] : undefined} />
              <p className="text-muted-foreground text-xs">
                관리번호 앞자리가 됩니다(예: 소방-1-1-1). 전체에서 유일해야 합니다.
                {isEdit &&
                  " 코드를 바꾸면 소속 소화기의 관리번호가 자동으로 갱신되어 QR을 다시 출력해야 합니다."}
              </p>
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="part_name">파트 이름</FieldLabel>
              <Input id="part_name" placeholder="예: 공사, 소방시설" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                disabled={submitting}
                onClick={handleDelete}
                className="sm:mr-auto"
              >
                삭제
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

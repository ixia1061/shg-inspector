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
import { siteSchema, type SiteFormValues } from "@/lib/validations/site.schema";
import type { Site } from "@/types/domain";

export function SiteFormDialog({ site }: { site?: Site }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!site;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: site?.name ?? "",
      address: site?.address ?? "",
      manager_name: site?.manager_name ?? "",
      manager_phone: site?.manager_phone ?? "",
    },
  });

  async function onSubmit(values: SiteFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("sites").update(values).eq("id", site.id)
      : await supabase.from("sites").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(isEdit ? "사업장 정보를 수정했습니다" : "사업장을 등록했습니다");
    setOpen(false);
    reset();
    router.refresh();
  }

  async function handleDelete() {
    if (!site) return;
    if (!confirm("이 사업장을 삭제하시겠습니까?\n소속된 건물/층/구역/차량도 함께 삭제됩니다.")) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("sites").delete().eq("id", site.id);
    setSubmitting(false);

    if (error) {
      toast.error("삭제에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success("사업장을 삭제했습니다");
    setOpen(false);
    router.push("/sites");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>수정</DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" /> 새 사업장
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "사업장 수정" : "사업장 등록"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">사업장명</FieldLabel>
              <Input id="name" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
              <p className="text-muted-foreground text-xs">
                관리번호 앞자리는 사업장이 아니라 '관리파트'에서 설정합니다(사업장 등록 후 상세
                화면에서 추가).
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="address">주소</FieldLabel>
              <Input id="address" {...register("address")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="manager_name">담당자명</FieldLabel>
              <Input id="manager_name" {...register("manager_name")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="manager_phone">담당자 연락처</FieldLabel>
              <Input id="manager_phone" {...register("manager_phone")} />
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

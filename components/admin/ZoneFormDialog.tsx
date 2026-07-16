"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
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
import { zoneSchema, type ZoneFormValues } from "@/lib/validations/building.schema";
import type { Zone } from "@/types/domain";

export function ZoneFormDialog({ floorId, zone }: { floorId: string; zone?: Zone }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!zone;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: { floor_id: floorId, name: zone?.name ?? "" },
  });

  async function onSubmit(values: ZoneFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("zones").update(values).eq("id", zone.id)
      : await supabase.from("zones").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(isEdit ? "구역 정보를 수정했습니다" : "구역을 등록했습니다");
    setOpen(false);
    if (!isEdit) reset({ floor_id: floorId, name: "" });
    router.refresh();
  }

  async function handleDelete() {
    if (!zone) return;
    if (!confirm("이 구역을 삭제하시겠습니까?\n소속 소화기는 구역만 해제되고 층에는 그대로 남습니다.")) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("zones").delete().eq("id", zone.id);
    setSubmitting(false);

    if (error) {
      toast.error("삭제에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success("구역을 삭제했습니다");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-xs" aria-label="구역 수정" />}>
          <Pencil className="size-3" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          <Plus className="size-4" /> 구역 추가
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "구역 수정" : "구역 등록"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="zone-name">구역명</FieldLabel>
              <Input id="zone-name" {...register("name")} />
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

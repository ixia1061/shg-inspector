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
import { floorSchema, type FloorFormValues } from "@/lib/validations/building.schema";
import type { Floor } from "@/types/domain";

export function FloorFormDialog({ buildingId, floor }: { buildingId: string; floor?: Floor }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!floor;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FloorFormValues>({
    resolver: zodResolver(floorSchema),
    defaultValues: {
      building_id: buildingId,
      floor_code: floor?.floor_code ?? "",
      name: floor?.name ?? "",
      order_index: floor?.order_index ?? 0,
    },
  });

  async function onSubmit(values: FloorFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("floors").update(values).eq("id", floor.id)
      : await supabase.from("floors").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(isEdit ? "층 정보를 수정했습니다" : "층을 등록했습니다");
    setOpen(false);
    if (!isEdit) reset({ building_id: buildingId, floor_code: "", name: "", order_index: 0 });
    router.refresh();
  }

  async function handleDelete() {
    if (!floor) return;
    if (!confirm("이 층을 삭제하시겠습니까?\n소속된 구역도 함께 삭제됩니다.")) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("floors").delete().eq("id", floor.id);
    setSubmitting(false);

    if (error) {
      toast.error("삭제에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success("층을 삭제했습니다");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="층 수정" />}>
          <Pencil className="size-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          <Plus className="size-4" /> 층 추가
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "층 수정" : "층 등록"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.floor_code}>
              <FieldLabel htmlFor="floor-code">층 코드 (관리번호에 사용, 예: 0=지하, 1, 2, R=옥상)</FieldLabel>
              <Input id="floor-code" {...register("floor_code")} />
              <FieldError errors={errors.floor_code ? [errors.floor_code] : undefined} />
              {isEdit && (
                <p className="text-muted-foreground text-xs">
                  층 코드를 바꾸면 소속 소화기의 관리번호가 자동으로 갱신됩니다. 이미 부착된 QR
                  라벨은 계속 사용할 수 있습니다.
                </p>
              )}
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="floor-name">층 이름 (표시용, 예: 지하1층, 3층, 옥상)</FieldLabel>
              <Input id="floor-name" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="floor-order">정렬 순서</FieldLabel>
              <Input
                id="floor-order"
                type="number"
                {...register("order_index", { valueAsNumber: true })}
              />
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

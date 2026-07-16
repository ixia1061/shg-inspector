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
import { floorSchema, type FloorFormValues } from "@/lib/validations/building.schema";

export function FloorFormDialog({ buildingId }: { buildingId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FloorFormValues>({
    resolver: zodResolver(floorSchema),
    defaultValues: { building_id: buildingId, floor_code: "", name: "", order_index: 0 },
  });

  async function onSubmit(values: FloorFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("floors").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success("층을 등록했습니다");
    setOpen(false);
    reset({ building_id: buildingId, floor_code: "", name: "", order_index: 0 });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Plus className="size-4" /> 층 추가
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>층 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.floor_code}>
              <FieldLabel htmlFor="floor-code">층 코드 (관리번호에 사용, 예: 0=지하, 1, 2, R=옥상)</FieldLabel>
              <Input id="floor-code" {...register("floor_code")} />
              <FieldError errors={errors.floor_code ? [errors.floor_code] : undefined} />
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

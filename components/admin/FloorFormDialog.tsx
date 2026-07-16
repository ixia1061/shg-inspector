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
    defaultValues: { building_id: buildingId, name: "", order_index: 0 },
  });

  async function onSubmit(values: FloorFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("floors").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: error.message });
      return;
    }

    toast.success("층을 등록했습니다");
    setOpen(false);
    reset({ building_id: buildingId, name: "", order_index: 0 });
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
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="floor-name">층 이름 (예: 3층, B1)</FieldLabel>
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

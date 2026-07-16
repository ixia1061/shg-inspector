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
import { zoneSchema, type ZoneFormValues } from "@/lib/validations/building.schema";

export function ZoneFormDialog({ floorId }: { floorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: { floor_id: floorId, name: "" },
  });

  async function onSubmit(values: ZoneFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("zones").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: error.message });
      return;
    }

    toast.success("구역을 등록했습니다");
    setOpen(false);
    reset({ floor_id: floorId, name: "" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Plus className="size-4" /> 구역 추가
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>구역 등록</DialogTitle>
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

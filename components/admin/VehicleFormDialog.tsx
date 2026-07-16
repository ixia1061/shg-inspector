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
import { vehicleSchema, type VehicleFormValues } from "@/lib/validations/vehicle.schema";

export function VehicleFormDialog({
  siteId,
  nextVehicleNo = 1,
}: {
  siteId: string;
  nextVehicleNo?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { site_id: siteId, vehicle_no: nextVehicleNo, name: "" },
  });

  async function onSubmit(values: VehicleFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("vehicles").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: error.message });
      return;
    }

    toast.success("차량을 등록했습니다");
    setOpen(false);
    reset({ site_id: siteId, vehicle_no: nextVehicleNo + 1, name: "" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-4" /> 차량 추가
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>차량 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.vehicle_no}>
              <FieldLabel htmlFor="vehicle-no">차량 번호 (관리번호에 사용)</FieldLabel>
              <Input
                id="vehicle-no"
                type="number"
                {...register("vehicle_no", { valueAsNumber: true })}
              />
              <FieldError errors={errors.vehicle_no ? [errors.vehicle_no] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="vehicle-name">차량명 (선택, 표시용)</FieldLabel>
              <Input id="vehicle-name" placeholder="예: 순찰차 1호" {...register("name")} />
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

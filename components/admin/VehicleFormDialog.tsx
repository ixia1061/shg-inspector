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
import { vehicleSchema, type VehicleFormValues } from "@/lib/validations/vehicle.schema";
import type { Vehicle } from "@/types/domain";

export function VehicleFormDialog({
  buildingId,
  vehicle,
  nextVehicleNo = 1,
}: {
  buildingId: string;
  vehicle?: Vehicle;
  nextVehicleNo?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!vehicle;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      building_id: buildingId,
      vehicle_no: vehicle?.vehicle_no ?? nextVehicleNo,
      plate_no: vehicle?.plate_no ?? "",
      name: vehicle?.name ?? "",
      department: vehicle?.department ?? "",
    },
  });

  async function onSubmit(values: VehicleFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("vehicles").update(values).eq("id", vehicle.id)
      : await supabase.from("vehicles").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(isEdit ? "차량 정보를 수정했습니다" : "차량을 등록했습니다");
    setOpen(false);
    if (!isEdit)
      reset({
        building_id: buildingId,
        vehicle_no: nextVehicleNo + 1,
        plate_no: "",
        name: "",
        department: "",
      });
    router.refresh();
  }

  async function handleDelete() {
    if (!vehicle) return;
    if (!confirm("이 차량을 삭제하시겠습니까?")) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
    setSubmitting(false);

    if (error) {
      toast.error("삭제에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success("차량을 삭제했습니다");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-xs" aria-label="차량 수정" />}>
          <Pencil className="size-3" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          <Plus className="size-4" /> 차량 추가
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "차량 수정" : "차량 등록"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.vehicle_no}>
              <FieldLabel htmlFor="vehicle-no">차량 번호 (건물 내 호수)</FieldLabel>
              <Input
                id="vehicle-no"
                type="number"
                {...register("vehicle_no", { valueAsNumber: true })}
              />
              <FieldError errors={errors.vehicle_no ? [errors.vehicle_no] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="vehicle-plate">차량 번호판</FieldLabel>
              <Input id="vehicle-plate" placeholder="예: 12가 3456" {...register("plate_no")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="vehicle-name">차량명 (차종)</FieldLabel>
              <Input id="vehicle-name" placeholder="예: 스타렉스, 소방펌프차" {...register("name")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="vehicle-department">관리부서</FieldLabel>
              <Input id="vehicle-department" placeholder="예: 소방, 전기, 통신" {...register("department")} />
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

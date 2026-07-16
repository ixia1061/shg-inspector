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
import { buildingSchema, type BuildingFormValues } from "@/lib/validations/building.schema";

export function BuildingFormDialog({
  siteId,
  nextBuildingNo = 1,
}: {
  siteId: string;
  nextBuildingNo?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: { site_id: siteId, building_no: nextBuildingNo, name: "", address: "" },
  });

  async function onSubmit(values: BuildingFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("buildings").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success("건물을 등록했습니다");
    setOpen(false);
    reset({ site_id: siteId, building_no: nextBuildingNo + 1, name: "", address: "" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-4" /> 건물 추가
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>건물 등록</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.building_no}>
              <FieldLabel htmlFor="building-no">건물 번호 (관리번호에 사용)</FieldLabel>
              <Input
                id="building-no"
                type="number"
                {...register("building_no", { valueAsNumber: true })}
              />
              <FieldError errors={errors.building_no ? [errors.building_no] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="building-name">건물명 (선택, 표시용)</FieldLabel>
              <Input id="building-name" placeholder="예: 본관, 신관" {...register("name")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="building-address">주소</FieldLabel>
              <Input id="building-address" {...register("address")} />
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

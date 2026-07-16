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
import { buildingSchema, type BuildingFormValues } from "@/lib/validations/building.schema";
import type { Building } from "@/types/domain";

export function BuildingFormDialog({
  siteId,
  building,
  nextBuildingNo = 1,
}: {
  siteId: string;
  building?: Building;
  nextBuildingNo?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!building;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: {
      site_id: siteId,
      building_no: building?.building_no ?? nextBuildingNo,
      name: building?.name ?? "",
      address: building?.address ?? "",
    },
  });

  async function onSubmit(values: BuildingFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = isEdit
      ? await supabase.from("buildings").update(values).eq("id", building.id)
      : await supabase.from("buildings").insert(values);
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(isEdit ? "건물 정보를 수정했습니다" : "건물을 등록했습니다");
    setOpen(false);
    if (!isEdit) reset({ site_id: siteId, building_no: nextBuildingNo + 1, name: "", address: "" });
    router.refresh();
  }

  async function handleDelete() {
    if (!building) return;
    if (!confirm("이 건물을 삭제하시겠습니까?\n소속된 층/구역도 함께 삭제됩니다.")) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("buildings").delete().eq("id", building.id);
    setSubmitting(false);

    if (error) {
      toast.error("삭제에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success("건물을 삭제했습니다");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="건물 수정" />}>
          <Pencil className="size-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          <Plus className="size-4" /> 건물 추가
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "건물 수정" : "건물 등록"}</DialogTitle>
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
              {isEdit && (
                <p className="text-muted-foreground text-xs">
                  건물 번호를 바꾸면 소속 소화기의 관리번호가 자동으로 갱신됩니다. 이미 부착된 QR
                  라벨은 계속 사용할 수 있습니다.
                </p>
              )}
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

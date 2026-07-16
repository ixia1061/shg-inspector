"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  extinguisherTypeSchema,
  type ExtinguisherTypeFormValues,
} from "@/lib/validations/extinguisherType.schema";
import type { ExtinguisherType } from "@/types/domain";

export function ExtinguisherTypeFormDialog({
  onCreated,
}: {
  /** 생성 직후 새 종류를 부모 폼에서 바로 선택할 수 있도록 콜백으로 알려준다. */
  onCreated?: (type: ExtinguisherType) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExtinguisherTypeFormValues>({
    resolver: zodResolver(extinguisherTypeSchema),
    defaultValues: { name: "", default_useful_life_years: 10 },
  });

  const noUsefulLife = watch("default_useful_life_years") === null;

  async function onSubmit(values: ExtinguisherTypeFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("extinguisher_types")
      .insert(values)
      .select("*")
      .single();
    setSubmitting(false);

    if (error) {
      toast.error("저장에 실패했습니다", { description: friendlyErrorMessage(error) });
      return;
    }

    toast.success(`소화기 종류 "${data.name}"를 추가했습니다`);
    setOpen(false);
    reset();
    onCreated?.(data);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" type="button" />}>
        <Plus className="size-4" /> 종류 추가
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>소화기 종류 추가</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            // 부모 폼(소화기 등록 폼) 안에서 열리므로 이벤트 전파를 반드시 끊는다.
            e.stopPropagation();
            void handleSubmit(onSubmit)(e);
          }}
        >
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="type-name">종류명</FieldLabel>
              <Input id="type-name" placeholder="예: 청정소화기" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field data-invalid={!!errors.default_useful_life_years}>
              <FieldLabel htmlFor="type-life">기본 내용연수(년)</FieldLabel>
              <div className="flex items-center gap-3">
                <Input
                  id="type-life"
                  type="number"
                  className="w-28"
                  disabled={noUsefulLife}
                  value={watch("default_useful_life_years") ?? ""}
                  onChange={(e) =>
                    setValue(
                      "default_useful_life_years",
                      e.target.value === "" ? undefined! : Number(e.target.value)
                    )
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={noUsefulLife}
                    onCheckedChange={(checked) =>
                      setValue("default_useful_life_years", checked ? null : 10)
                    }
                  />
                  내용연수 없음
                </label>
              </div>
              <FieldError
                errors={
                  errors.default_useful_life_years ? [errors.default_useful_life_years] : undefined
                }
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중..." : "추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

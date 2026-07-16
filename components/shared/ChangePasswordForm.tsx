"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "@/lib/validations/auth.schema";

export function ChangePasswordForm() {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);

    if (error) {
      toast.error("비밀번호 변경에 실패했습니다", { description: error.message });
      return;
    }

    toast.success("비밀번호가 변경되었습니다");
    reset();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-sm flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">새 비밀번호</FieldLabel>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          <FieldError errors={errors.password ? [errors.password] : undefined} />
        </Field>
        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">새 비밀번호 확인</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          <FieldError errors={errors.confirmPassword ? [errors.confirmPassword] : undefined} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={submitting}>
        {submitting ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}

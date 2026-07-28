"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { submitSignupAction } from "@/app/(auth)/signup/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signupSchema, type SignupFormValues } from "@/lib/validations/auth.schema";

/**
 * 점검자 가입 신청 폼.
 * 신청만 접수하고 자동 로그인은 하지 않는다 — 사업장 관리자가 승인해야 이용할 수 있다.
 */
export function SignupForm() {
  const [submitting, setSubmitting] = useState(false);
  const [doneAdminName, setDoneAdminName] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { joinCode: "", name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignupFormValues) {
    setSubmitting(true);
    try {
      const { adminName } = await submitSignupAction(values);
      setDoneAdminName(adminName);
    } catch (err) {
      toast.error("가입 신청에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (doneAdminName !== null) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="text-primary size-10" />
          <div>
            <p className="font-semibold">가입 신청이 접수되었습니다</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {doneAdminName ? `${doneAdminName} 님` : "관리자"}이 승인하면 로그인할 수 있습니다.
              점검할 사업장도 승인할 때 함께 정해집니다.
            </p>
          </div>
          <Button render={<Link href="/login" />} nativeButton={false} className="w-full">
            로그인 화면으로
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">점검자 가입 신청</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.joinCode}>
              <FieldLabel htmlFor="joinCode">가입코드</FieldLabel>
              <Input
                id="joinCode"
                autoFocus
                autoCapitalize="characters"
                className="font-mono tracking-widest uppercase"
                {...register("joinCode")}
              />
              <FieldDescription>담당 관리자에게 받은 코드를 입력하세요.</FieldDescription>
              <FieldError errors={errors.joinCode ? [errors.joinCode] : undefined} />
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">이름</FieldLabel>
              <Input id="name" autoComplete="name" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">이메일</FieldLabel>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              <FieldDescription>로그인할 때 쓰는 아이디입니다.</FieldDescription>
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">비밀번호</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
              />
              <FieldDescription>8자 이상 입력하세요.</FieldDescription>
              <FieldError errors={errors.password ? [errors.password] : undefined} />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "신청 중..." : "가입 신청"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

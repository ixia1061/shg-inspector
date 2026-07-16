"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createUserAction } from "@/app/(admin)/users/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserSchema, type CreateUserFormValues } from "@/lib/validations/user.schema";
import type { Site } from "@/types/domain";

const ROLE_ITEMS = [
  { value: "inspector", label: "점검자" },
  { value: "admin", label: "관리자" },
];

export function CreateUserDialog({ sites }: { sites: Site[] }) {
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
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", password: "", name: "", role: "inspector", siteIds: [] },
  });

  const siteIds = watch("siteIds");
  const role = watch("role");

  async function onSubmit(values: CreateUserFormValues) {
    setSubmitting(true);
    try {
      await createUserAction(values);
      toast.success("사용자를 생성했습니다");
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error("사용자 생성에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> 새 사용자
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>사용자 생성</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">이름</FieldLabel>
              <Input id="name" {...register("name")} />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">이메일</FieldLabel>
              <Input id="email" type="email" {...register("email")} />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">임시 비밀번호</FieldLabel>
              <Input id="password" type="text" {...register("password")} />
              <FieldError errors={errors.password ? [errors.password] : undefined} />
            </Field>
            <Field>
              <FieldLabel>역할</FieldLabel>
              <Select
                items={ROLE_ITEMS}
                value={role}
                onValueChange={(v) => setValue("role", v as "admin" | "inspector")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inspector">점검자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {role === "inspector" && (
              <Field>
                <FieldLabel>담당 사업장</FieldLabel>
                <div className="flex flex-col gap-2">
                  {sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={siteIds.includes(site.id)}
                        onCheckedChange={(checked) => {
                          setValue(
                            "siteIds",
                            checked ? [...siteIds, site.id] : siteIds.filter((id) => id !== site.id)
                          );
                        }}
                      />
                      {site.name}
                    </label>
                  ))}
                </div>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "생성 중..." : "생성"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

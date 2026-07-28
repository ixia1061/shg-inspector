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
import type { ManagementPart, Site } from "@/types/domain";

const ROLE_ITEMS = [
  { value: "inspector", label: "점검자" },
  { value: "admin", label: "관리자" },
];

/**
 * 계정 생성 다이얼로그.
 * - 시스템관리자: 관리자·점검자를 만들고 사업장 "전체" 단위로 배정한다.
 * - 일반 관리자: 자기가 맡은 관리파트 범위의 점검자만 만든다(역할 선택 없음).
 */
export function CreateUserDialog({
  isSuper,
  sites,
  parts,
}: {
  isSuper: boolean;
  sites: Site[];
  /** 일반 관리자 모드에서 배정할 수 있는 관리파트(이미 권한 범위로 좁혀서 넘어온다) */
  parts: ManagementPart[];
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
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      role: "inspector",
      siteIds: [],
    },
  });

  const siteIds = watch("siteIds");
  const role = watch("role");
  // 관리자에게는 자기 담당 사업장만 보여준다(파트는 화면에 드러내지 않는다).
  const grantableSiteIds = new Set(parts.map((p) => p.site_id));
  const grantableSites = sites.filter((s) => grantableSiteIds.has(s.id));

  async function onSubmit(values: CreateUserFormValues) {
    setSubmitting(true);
    try {
      await createUserAction(values);
      toast.success(isSuper ? "사용자를 생성했습니다" : "점검자를 생성했습니다");
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
        <Plus className="size-4" /> {isSuper ? "새 사용자" : "점검자 추가"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSuper ? "사용자 생성" : "점검자 생성"}</DialogTitle>
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
            {isSuper ? (
              <>
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
                <Field>
                  <FieldLabel>담당 사업장</FieldLabel>
                  <p className="text-muted-foreground text-xs">
                    {role === "admin"
                      ? "관리자는 배정된 사업장의 건물·소화기·점검만 관리합니다."
                      : "점검자는 배정된 사업장만 조회·점검합니다."}
                  </p>
                  <div className="flex flex-col gap-2">
                    {sites.map((site) => (
                      <label key={site.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={siteIds.includes(site.id)}
                          onCheckedChange={(checked) => {
                            setValue(
                              "siteIds",
                              checked
                                ? [...siteIds, site.id]
                                : siteIds.filter((id) => id !== site.id)
                            );
                          }}
                        />
                        {site.name}
                      </label>
                    ))}
                  </div>
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel>점검 범위 (사업장)</FieldLabel>
                <p className="text-muted-foreground text-xs">
                  체크한 사업장의 소화기를 점검할 수 있습니다. 내가 담당하는 사업장만 보입니다.
                </p>
                <div className="flex flex-col gap-2">
                  {grantableSites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={siteIds.includes(site.id)}
                        onCheckedChange={(checked) => {
                          setValue(
                            "siteIds",
                            checked
                              ? [...siteIds, site.id]
                              : siteIds.filter((id) => id !== site.id)
                          );
                        }}
                      />
                      {site.name}
                    </label>
                  ))}
                  {grantableSites.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      배정할 수 있는 사업장이 없습니다. 시스템관리자에게 담당 사업장 배정을
                      요청하세요.
                    </p>
                  )}
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

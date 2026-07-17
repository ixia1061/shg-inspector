"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteUserAction,
  toggleUserActiveAction,
  updateUserRoleAction,
} from "@/app/(admin)/users/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { UserSitesDialog } from "@/components/admin/UserSitesDialog";
import { ASSIGNABLE_ROLE_ITEMS, ROLE_LABELS } from "@/lib/utils/roles";
import type { Site, UserRole } from "@/types/domain";

export function UserRow({
  id,
  name,
  role,
  isActive,
  siteNames,
  sites,
  assignedSiteIds,
}: {
  id: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  siteNames: string[];
  sites: Site[];
  assignedSiteIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(isActive);

  // 시스템관리자 계정은 역할 변경·비활성·삭제가 불가능하도록 잠근다.
  const locked = role === "super_admin";

  function handleRoleChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      try {
        await updateUserRoleAction(id, value as UserRole);
        router.refresh();
      } catch (err) {
        toast.error("역할 변경에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  function handleToggleActive() {
    const next = !active;
    startTransition(async () => {
      try {
        await toggleUserActiveAction(id, next);
        setActive(next);
        router.refresh();
      } catch (err) {
        toast.error("상태 변경에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  function handleDelete() {
    if (!confirm(`"${name}" 사용자를 삭제하시겠습니까?\n삭제하면 로그인할 수 없게 됩니다.`)) return;
    startTransition(async () => {
      try {
        await deleteUserAction(id);
        toast.success("사용자를 삭제했습니다");
        router.refresh();
      } catch (err) {
        toast.error("삭제에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell>
        {locked ? (
          <span className="inline-flex h-9 items-center rounded-md bg-primary/10 px-3 text-sm font-medium text-primary">
            {ROLE_LABELS.super_admin}
          </span>
        ) : (
          <Select
            items={ASSIGNABLE_ROLE_ITEMS}
            value={role}
            onValueChange={handleRoleChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inspector">점검자</SelectItem>
              <SelectItem value="admin">관리자</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {locked ? (
          <span>전체 (시스템관리자)</span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <span>{siteNames.length ? siteNames.join(", ") : "미배정"}</span>
            <UserSitesDialog
              userId={id}
              userName={name}
              sites={sites}
              assignedSiteIds={assignedSiteIds}
            />
          </div>
        )}
      </TableCell>
      <TableCell>
        {locked ? (
          <span className="text-muted-foreground text-sm">활성 (보호됨)</span>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={isPending}>
              {active ? "활성" : "비활성"}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
              삭제
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

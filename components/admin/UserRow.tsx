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
import type { UserRole } from "@/types/domain";

const ROLE_ITEMS = [
  { value: "inspector", label: "점검자" },
  { value: "admin", label: "관리자" },
];

export function UserRow({
  id,
  name,
  role,
  isActive,
  siteNames,
}: {
  id: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  siteNames: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(isActive);

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
        <Select items={ROLE_ITEMS} value={role} onValueChange={handleRoleChange} disabled={isPending}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inspector">점검자</SelectItem>
            <SelectItem value="admin">관리자</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {siteNames.length ? siteNames.join(", ") : "-"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={isPending}>
            {active ? "활성" : "비활성"}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
            삭제
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

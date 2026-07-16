"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { toggleUserActiveAction, updateUserRoleAction } from "@/app/(admin)/users/actions";
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

  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell>
        <Select value={role} onValueChange={handleRoleChange} disabled={isPending}>
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
        <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={isPending}>
          {active ? "활성" : "비활성"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

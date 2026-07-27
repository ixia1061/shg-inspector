"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveSignupAction, rejectSignupAction } from "@/app/(admin)/users/actions";
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
import { TableCell, TableRow } from "@/components/ui/table";
import { formatPartLabel } from "@/lib/utils/part";
import type { ManagementPart } from "@/types/domain";

/**
 * 가입 신청 1건. 승인하면서 점검 범위(관리파트)를 함께 지정한다.
 * 거부하면 계정이 삭제되어 같은 이메일로 다시 신청할 수 있다.
 */
export function PendingSignupRow({
  id,
  name,
  email,
  siteName,
  requestedAt,
  parts,
}: {
  id: string;
  name: string;
  email: string | null;
  siteName: string;
  requestedAt: string;
  /** 신청 사업장에서 내가 부여할 수 있는 관리파트 */
  parts: ManagementPart[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // 기본은 전체 선택 — 대부분 그 사업장 전체를 맡기려고 승인한다.
  const [selected, setSelected] = useState<string[]>(parts.map((p) => p.id));

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveSignupAction(id, selected);
        toast.success(`${name} 님의 가입을 승인했습니다`);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("승인에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  function handleReject() {
    if (!confirm(`"${name}" 님의 가입 신청을 거부하시겠습니까?\n신청 계정은 삭제됩니다.`)) return;
    startTransition(async () => {
      try {
        await rejectSignupAction(id);
        toast.success("가입 신청을 거부했습니다");
        router.refresh();
      } catch (err) {
        toast.error("거부에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{email ?? "-"}</TableCell>
      <TableCell className="text-sm">{siteName}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {new Date(requestedAt).toLocaleDateString("ko-KR")}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="sm" disabled={isPending} />}>승인</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{name} 님 가입 승인</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <p className="text-muted-foreground text-sm">
                  {siteName} · {email ?? "-"}
                </p>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">점검 범위 (관리파트)</p>
                  {parts.length ? (
                    parts.map((part) => (
                      <label key={part.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected.includes(part.id)}
                          onCheckedChange={(checked) =>
                            setSelected((prev) =>
                              checked ? [...prev, part.id] : prev.filter((x) => x !== part.id)
                            )
                          }
                        />
                        {formatPartLabel(part)}
                      </label>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      이 사업장에 부여할 수 있는 관리파트가 없습니다. 승인만 하고 나중에 점검자
                      배정에서 권한을 줄 수 있습니다.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={handleApprove} disabled={isPending}>
                  {isPending ? "승인 중..." : "승인"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" size="sm" onClick={handleReject} disabled={isPending}>
            거부
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { approveSignupAction, rejectSignupAction } from "@/app/(admin)/users/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ManagementPart } from "@/types/domain";

/**
 * 가입 신청 1건. 승인하면 신청한 **사업장 전체**의 점검 권한을 준다.
 * (DB 배정은 파트 단위지만, 파트가 많아 하나씩 고르기 번거로우므로 사업장으로 묶는다 —
 *  내가 맡은 파트만 넘어가므로 관리자 경계는 그대로다.)
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
  /** 신청 사업장에서 내가 부여할 수 있는 관리파트(승인 시 전부 부여된다) */
  parts: ManagementPart[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveSignupAction(id);
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
                <p className="text-muted-foreground text-sm">{email ?? "-"}</p>
                <div className="bg-muted flex flex-col gap-1 rounded-md p-3 text-sm">
                  <p className="font-medium">점검 범위</p>
                  {parts.length ? (
                    <p>
                      <b>{siteName}</b> 전체의 소화기를 점검할 수 있게 됩니다.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      {siteName}에 부여할 수 있는 관리파트가 없습니다. 승인만 하고 나중에{" "}
                      <b>[범위 변경]</b>으로 권한을 줄 수 있습니다.
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

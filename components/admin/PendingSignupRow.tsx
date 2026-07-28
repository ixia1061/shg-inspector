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
import type { Site } from "@/types/domain";

/**
 * 가입 신청 1건. 가입코드는 관리자에게 붙어 있으므로, 승인할 때 **내 담당 사업장 중에서**
 * 이 점검자가 맡을 곳을 골라 준다. 담당 사업장이 하나면 고를 것이 없어 자동으로 체크한다.
 * 거부하면 계정이 삭제되어 같은 이메일로 다시 신청할 수 있다.
 */
export function PendingSignupRow({
  id,
  name,
  email,
  adminName,
  requestedAt,
  sites,
  showAdminColumn,
}: {
  id: string;
  name: string;
  email: string | null;
  /** 이 신청을 받은 관리자(= 코드 주인) */
  adminName: string;
  requestedAt: string;
  /** 내가 이 점검자에게 줄 수 있는 사업장 */
  sites: Site[];
  /** 시스템관리자처럼 남의 신청도 보는 경우에만 관리자 열을 보여준다 */
  showAdminColumn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // 담당 사업장이 하나뿐이면 고를 것이 없다.
  const [selected, setSelected] = useState<string[]>(sites.length === 1 ? [sites[0].id] : []);

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
      {showAdminColumn && <TableCell className="text-sm">{adminName}</TableCell>}
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
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">점검할 사업장</p>
                  <p className="text-muted-foreground text-xs">
                    체크한 사업장의 소화기를 점검할 수 있습니다. 승인 후에도 <b>[범위 변경]</b>으로
                    바꿀 수 있습니다.
                  </p>
                  {sites.length ? (
                    sites.map((site) => (
                      <label key={site.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected.includes(site.id)}
                          onCheckedChange={(checked) =>
                            setSelected((prev) =>
                              checked ? [...prev, site.id] : prev.filter((x) => x !== site.id)
                            )
                          }
                        />
                        {site.name}
                      </label>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      배정할 수 있는 사업장이 없습니다. 시스템관리자에게 담당 사업장 배정을
                      요청하세요.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={handleApprove} disabled={isPending || selected.length === 0}>
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

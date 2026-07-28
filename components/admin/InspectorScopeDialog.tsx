"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateInspectorSitesAction } from "@/app/(admin)/users/actions";
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
import type { Site } from "@/types/domain";

/**
 * 점검자의 점검 범위를 사업장 단위로 바꾼다(사용자 관리 목록에서 바로).
 * 시스템관리자가 "사업장 전체"로 배정한 곳은 관리자가 풀 수 없으므로 잠긴 상태로 보여준다.
 */
export function InspectorScopeDialog({
  inspectorId,
  inspectorName,
  sites,
  assignedSiteIds,
  wholeSiteIds,
  myWholeSiteIds,
}: {
  inspectorId: string;
  inspectorName: string;
  /** 내가 부여할 수 있는 사업장 */
  sites: Site[];
  /** 현재 점검 가능한 사업장(파트 배정 + 사업장 전체 배정) */
  assignedSiteIds: string[];
  /** 점검자가 "사업장 전체"로 배정받은 곳 */
  wholeSiteIds: string[];
  /** 내가 통째로 담당하는 사업장 — 여기 없는 전체 배정은 내가 풀 수 없다 */
  myWholeSiteIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(assignedSiteIds);

  // 열 때마다 서버 상태로 되돌린다(닫고 다시 열면 저장 안 된 변경은 사라진다).
  function handleOpenChange(next: boolean) {
    if (next) setSelected(assignedSiteIds);
    setOpen(next);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateInspectorSitesAction(inspectorId, selected);
        toast.success("점검 범위를 변경했습니다");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error("점검 범위 변경에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>범위 변경</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{inspectorName} 님 점검 범위</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            체크한 사업장의 소화기를 스캔·점검할 수 있습니다.
          </p>
          {sites.map((site) => {
            // 내 담당이 아닌 사업장을 시스템관리자가 통째로 줬다면 내가 풀 수 없다.
            const locked = wholeSiteIds.includes(site.id) && !myWholeSiteIds.includes(site.id);
            return (
              <label
                key={site.id}
                className="flex items-center gap-2 text-sm"
                title={locked ? "시스템관리자가 배정한 범위라 여기서 해제할 수 없습니다" : undefined}
              >
                <Checkbox
                  checked={locked || selected.includes(site.id)}
                  disabled={locked}
                  onCheckedChange={(checked) =>
                    setSelected((prev) =>
                      checked ? [...prev, site.id] : prev.filter((id) => id !== site.id)
                    )
                  }
                />
                {site.name}
                {locked && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    전체 배정됨
                  </span>
                )}
              </label>
            );
          })}
          {sites.length === 0 && (
            <p className="text-muted-foreground text-sm">
              배정할 수 있는 사업장이 없습니다. 시스템관리자에게 담당 사업장 배정을 요청하세요.
            </p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={handleSave} disabled={isPending || sites.length === 0}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateUserSitesAction } from "@/app/(admin)/users/actions";
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
import type { ManagementPart, Site } from "@/types/domain";

/**
 * 시스템관리자가 특정 사용자(관리자/점검자)의 담당 범위를 배정한다.
 * 사업장마다 "전체"(그 사업장의 현재·미래 모든 파트) 또는 "특정 파트"를 고를 수 있다.
 */
export function UserSitesDialog({
  userId,
  userName,
  sites,
  parts,
  assignedSiteIds,
  assignedPartIds,
}: {
  userId: string;
  userName: string;
  sites: Site[];
  parts: ManagementPart[];
  assignedSiteIds: string[];
  assignedPartIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wholeSites, setWholeSites] = useState<string[]>(assignedSiteIds);
  const [selParts, setSelParts] = useState<string[]>(assignedPartIds);
  const [saving, setSaving] = useState(false);

  function resetToAssigned() {
    setWholeSites(assignedSiteIds);
    setSelParts(assignedPartIds);
  }

  function toggleWhole(siteId: string, checked: boolean) {
    if (checked) {
      setWholeSites((prev) => [...new Set([...prev, siteId])]);
      // 전체 배정 시 그 사업장의 개별 파트 선택은 정리
      const sitePartIds = new Set(parts.filter((p) => p.site_id === siteId).map((p) => p.id));
      setSelParts((prev) => prev.filter((id) => !sitePartIds.has(id)));
    } else {
      setWholeSites((prev) => prev.filter((id) => id !== siteId));
    }
  }

  function togglePart(part: ManagementPart, checked: boolean) {
    if (checked) {
      setSelParts((prev) => [...new Set([...prev, part.id])]);
      // 개별 파트를 고르면 그 사업장의 "전체"는 해제
      setWholeSites((prev) => prev.filter((id) => id !== part.site_id));
    } else {
      setSelParts((prev) => prev.filter((id) => id !== part.id));
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateUserSitesAction(userId, wholeSites, selParts);
      toast.success("담당 범위를 저장했습니다");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error("저장에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetToAssigned();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Building2 className="size-4" /> 담당 범위
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{userName} · 담당 범위</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {sites.length ? (
            sites.map((site) => {
              const siteParts = parts.filter((p) => p.site_id === site.id);
              const isWhole = wholeSites.includes(site.id);
              return (
                <div key={site.id} className="rounded-md border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={isWhole}
                      onCheckedChange={(c) => toggleWhole(site.id, c === true)}
                    />
                    {site.name} <span className="text-muted-foreground font-normal">전체</span>
                  </label>
                  {siteParts.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5 pl-6">
                      {siteParts.map((part) => (
                        <label key={part.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={isWhole || selParts.includes(part.id)}
                            disabled={isWhole}
                            onCheckedChange={(c) => togglePart(part, c === true)}
                          />
                          {part.name}
                          <span className="text-muted-foreground font-mono text-xs">
                            ({part.code})
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {siteParts.length === 0 && (
                    <p className="text-muted-foreground mt-1 pl-6 text-xs">
                      등록된 관리파트가 없습니다.
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm">등록된 사업장이 없습니다.</p>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

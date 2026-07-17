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
import type { Site } from "@/types/domain";

/** 시스템관리자가 특정 사용자(관리자/점검자)의 담당 사업장을 배정/변경하는 다이얼로그. */
export function UserSitesDialog({
  userId,
  userName,
  sites,
  assignedSiteIds,
}: {
  userId: string;
  userName: string;
  sites: Site[];
  assignedSiteIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(assignedSiteIds);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    try {
      await updateUserSitesAction(userId, selected);
      toast.success("담당 사업장을 저장했습니다");
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
        if (next) setSelected(assignedSiteIds);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Building2 className="size-4" /> 담당 사업장
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{userName} · 담당 사업장</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {sites.length ? (
            sites.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                {s.name}
              </label>
            ))
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

"use client";

/* eslint-disable @next/next/no-img-element */

import { Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deletePhotosAction } from "@/app/actions/photoActions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface ManagedPhoto {
  id: string;
  url: string;
  assetCode: string;
  inspectedAt: string | null;
}

export function PhotoManager({ photos }: { photos: ManagedPhoto[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  /** 선택(또는 전체) 사진을 ZIP으로 내려받는다. ZIP 내부는 관리번호별 폴더로 정리된다. */
  async function handleDownload(ids: string[]) {
    setDownloading(true);
    try {
      const res = await fetch("/api/photos/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: ids }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `다운로드 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `점검사진_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP 다운로드를 시작했습니다");
    } catch (err) {
      toast.error("다운로드에 실패했습니다", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDownloading(false);
    }
  }

  const groups = photos.reduce<Map<string, ManagedPhoto[]>>((map, photo) => {
    const list = map.get(photo.assetCode) ?? [];
    list.push(photo);
    map.set(photo.assetCode, list);
    return map;
  }, new Map());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === photos.length ? new Set() : new Set(photos.map((p) => p.id))));
  }

  function handleDelete() {
    if (!selected.size) return;
    if (!confirm(`선택한 사진 ${selected.size}장을 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`)) return;

    startTransition(async () => {
      try {
        const { deleted } = await deletePhotosAction([...selected]);
        toast.success(`사진 ${deleted}장을 삭제했습니다`);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        toast.error("삭제에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  if (!photos.length) {
    return <p className="text-muted-foreground text-sm">등록된 점검 사진이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={toggleAll} disabled={isPending || downloading}>
          {selected.size === photos.length ? "전체 해제" : "전체 선택"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload([...selected])}
          disabled={isPending || downloading || selected.size === 0}
        >
          <Download className="size-4" /> 선택 다운로드 ({selected.size})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownload([])}
          disabled={isPending || downloading}
        >
          <Download className="size-4" /> {downloading ? "ZIP 생성 중..." : "전체 다운로드"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isPending || downloading || selected.size === 0}
        >
          <Trash2 className="size-4" /> 선택 삭제 ({selected.size})
        </Button>
        <span className="text-muted-foreground ml-auto text-sm">총 {photos.length}장</span>
      </div>

      {[...groups.entries()].map(([assetCode, groupPhotos]) => (
        <div key={assetCode} className="flex flex-col gap-2">
          <h2 className="font-mono text-sm font-semibold">
            {assetCode} <span className="text-muted-foreground font-sans">({groupPhotos.length}장)</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {groupPhotos.map((photo) => {
              const isSelected = selected.has(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggle(photo.id)}
                  className={cn(
                    "relative rounded-md border-2 transition-colors",
                    isSelected ? "border-destructive" : "border-transparent"
                  )}
                >
                  <img
                    src={photo.url}
                    alt={`${assetCode} 점검 사진`}
                    className="size-28 rounded object-cover"
                  />
                  <span className="absolute top-1 left-1">
                    <Checkbox checked={isSelected} className="bg-background/80" />
                  </span>
                  {photo.inspectedAt && (
                    <span className="bg-background/80 text-muted-foreground absolute right-0 bottom-0 left-0 rounded-b px-1 py-0.5 text-[10px]">
                      {new Date(photo.inspectedAt).toLocaleDateString("ko-KR")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

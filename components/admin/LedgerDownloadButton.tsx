"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Site } from "@/types/domain";

/** 사업장별 소화기 관리대장(.xlsx)을 각각 내려받는 버튼 묶음. RLS로 담당 사업장만 조회된다. */
export function LedgerDownloadButtons({ sites }: { sites: Site[] }) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(site: Site) {
    setDownloadingId(site.id);
    try {
      const res = await fetch(`/api/ledger/download?site=${encodeURIComponent(site.id)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `다운로드 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `소화기관리대장_${site.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${site.name} 관리대장 다운로드를 시작했습니다`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다운로드에 실패했습니다");
    } finally {
      setDownloadingId(null);
    }
  }

  if (sites.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {sites.map((site) => (
        <Button
          key={site.id}
          variant="outline"
          size="sm"
          onClick={() => handleDownload(site)}
          disabled={downloadingId !== null}
        >
          <Download className="size-4" />
          {downloadingId === site.id ? "생성 중..." : `관리대장 · ${site.name}`}
        </Button>
      ))}
    </div>
  );
}

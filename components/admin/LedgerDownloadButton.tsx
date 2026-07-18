"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** 소화기 관리대장(.xlsx)을 내려받는다. RLS로 담당 사업장 범위만 포함된다. */
export function LedgerDownloadButton() {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch("/api/ledger/download");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `다운로드 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `소화기관리대장_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("관리대장 다운로드를 시작했습니다");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다운로드에 실패했습니다");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
      <Download className="size-4" /> {downloading ? "생성 중..." : "관리대장 다운로드"}
    </Button>
  );
}

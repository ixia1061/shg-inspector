"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Site } from "@/types/domain";

/** 'YYYY-MM' → '2026년 7월' */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

/**
 * 소화기 관리대장(.xlsx) 다운로드 버튼. RLS로 담당 사업장만 조회된다.
 *
 * - month 없음(점검현황): **지금 진행 중인 점검** 기준 대장. 화면이 보여주는 내용과 같다.
 * - month 지정(관리대장 보관함): 그 달 기준 대장 — 그 달의 마지막 점검 내용이 실린다.
 */
export function LedgerDownloadButton({
  site,
  month,
  label,
}: {
  site: Site;
  /** 'YYYY-MM'. 없으면 현재 상태 대장 */
  month?: string;
  /** 버튼 문구(기본: 사업장명 + 관리대장) */
  label?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const query = new URLSearchParams({ site: site.id });
      if (month) query.set("month", month);

      const res = await fetch(`/api/ledger/download?${query}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `다운로드 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = month
        ? `소화기관리대장_${site.name}_${month}.xlsx`
        : `소화기관리대장_${site.name}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        month
          ? `${site.name} ${monthLabel(month)} 관리대장을 내려받습니다`
          : `${site.name} 관리대장 다운로드를 시작했습니다`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다운로드에 실패했습니다");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
      <Download className="size-4" />
      {downloading ? "생성 중..." : (label ?? `${site.name} 관리대장`)}
    </Button>
  );
}

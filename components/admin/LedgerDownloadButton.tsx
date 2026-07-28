"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Site } from "@/types/domain";

/** 이번달을 뜻하는 값. 이 값이면 month 파라미터 없이 "현재 상태" 대장을 받는다. */
const CURRENT = "current";
/** 고를 수 있는 지난달 개수 */
const PAST_MONTHS = 12;

/** 오늘(KST) 기준 'YYYY-MM' */
function kstMonth(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 7);
}

/** 'YYYY-MM' → '2026년 7월' */
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** [{value,label}] — 이번달(현재 상태) + 지난 12개월 */
function buildMonthItems(): { value: string; label: string }[] {
  const now = new Date();
  const items = [{ value: CURRENT, label: "현재 상태" }];
  for (let i = 1; i <= PAST_MONTHS; i++) {
    // 날짜를 1일로 고정해야 말일(31일)에서 달을 뺄 때 건너뛰지 않는다.
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = kstMonth(d);
    items.push({ value, label: monthLabel(value) });
  }
  return items;
}

/**
 * 선택된 사업장의 소화기 관리대장(.xlsx)을 내려받는다. RLS로 담당 사업장만 조회된다.
 * 월을 고르면 그 달 기준 대장(그 달의 마지막 점검 내용)을 받는다 — 지난달 점검 기록을
 * 나중에도 그대로 뽑을 수 있다. "현재 상태"는 지금까지와 같은 최신 기준 대장.
 */
export function LedgerDownloadButton({ site }: { site: Site }) {
  const [downloading, setDownloading] = useState(false);
  const [month, setMonth] = useState(CURRENT);
  const monthItems = buildMonthItems();

  async function handleDownload() {
    setDownloading(true);
    try {
      const query = new URLSearchParams({ site: site.id });
      if (month !== CURRENT) query.set("month", month);

      const res = await fetch(`/api/ledger/download?${query}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `다운로드 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        month === CURRENT
          ? `소화기관리대장_${site.name}_${new Date().toISOString().slice(0, 10)}.xlsx`
          : `소화기관리대장_${site.name}_${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        month === CURRENT
          ? `${site.name} 관리대장 다운로드를 시작했습니다`
          : `${site.name} ${monthLabel(month)} 관리대장 다운로드를 시작했습니다`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "다운로드에 실패했습니다");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select items={monthItems} value={month} onValueChange={(v) => setMonth(v ?? CURRENT)}>
        <SelectTrigger className="w-32" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
        <Download className="size-4" />
        {downloading ? "생성 중..." : `${site.name} 관리대장`}
      </Button>
    </div>
  );
}

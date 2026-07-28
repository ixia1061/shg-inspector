"use client";

import { FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";

import { LedgerDownloadButton, monthLabel } from "@/components/admin/LedgerDownloadButton";
import { SiteFilterButtons } from "@/components/admin/SiteFilterButtons";
import type { Site } from "@/types/domain";

export interface LedgerMonth {
  siteId: string;
  month: string;
  /** 그 달에 점검한 소화기 대수 */
  inspectedCount: number;
  /** 그 사업장의 전체 소화기 대수(그 달 점검률 표시용) */
  totalCount: number;
}

/**
 * 관리대장 보관함 — 점검이 끝난 달의 대장을 사업장별로 골라 받는다.
 * 점검현황은 진행 중인 이번 달만 다루고, 지난 달 기록은 여기서 관리한다.
 */
export function LedgerArchive({
  sites,
  months,
  currentMonth,
}: {
  sites: Site[];
  months: LedgerMonth[];
  /** 오늘(KST) 기준 'YYYY-MM' — 아직 진행 중인 달을 구분해 표시한다 */
  currentMonth: string;
}) {
  // 담당 사업장이 하나면 버튼이 의미 없으므로 그 사업장으로 고정한다.
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const site = sites.find((s) => s.id === siteId) ?? sites[0];

  const rows = useMemo(
    () =>
      months
        .filter((m) => m.siteId === siteId)
        .sort((a, b) => b.month.localeCompare(a.month)), // 최신 달이 위로
    [months, siteId]
  );

  if (sites.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        담당 사업장이 없습니다. 시스템관리자에게 사업장 배정을 요청하세요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sites.length > 1 && (
        <SiteFilterButtons sites={sites} value={siteId} onChange={setSiteId} />
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          아직 점검 기록이 있는 달이 없습니다. 점검을 시작하면 그 달이 여기에 나타납니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const rate =
              row.totalCount > 0 ? Math.round((row.inspectedCount / row.totalCount) * 100) : 0;
            return (
              <li
                key={row.month}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-muted-foreground size-5 shrink-0" />
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      {monthLabel(row.month)}
                      {row.month === currentMonth && (
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs">
                          진행 중
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      점검 {row.inspectedCount}대 / 전체 {row.totalCount}대 ({rate}%)
                      {row.month === currentMonth && " · 점검이 더 들어오면 내용이 바뀝니다"}
                    </p>
                  </div>
                </div>
                {site && (
                  <LedgerDownloadButton site={site} month={row.month} label="관리대장 받기" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

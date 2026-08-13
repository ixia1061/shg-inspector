"use client";

import Link from "next/link";
import { useState } from "react";

import { Pagination } from "@/components/ui/pagination";
import { formatKstDate } from "@/lib/utils/datetime";

const PAGE_SIZE = 50;

export interface AbnormalInspectionItem {
  id: string;
  extinguisherId: string;
  assetCode: string;
  siteId: string;
  location: string;
  inspectedAt: string;
  /** 월 구분용 'YYYY-MM' (KST). ISO 문자열을 그대로 자르면 00~09시 점검이 지난달로 밀린다. */
  monthKey: string;
  inspectorName: string;
  /** 점검자가 적은 불량 내용(memo) */
  memo: string | null;
  /** 체크가 풀린 점검사항 */
  defectItems: string;
  /** 조치 기록(없으면 아직 조치 전) */
  actionNote: string | null;
  resolvedAt: string | null;
  /** 이 점검 이후에 같은 소화기를 다시 점검했는지 — 미조치인 채 넘어간 건이 왜 위 목록에 없는지 설명한다 */
  superseded: boolean;
}

/** 월 헤더를 붙여 이상점검 이력을 보여준다. 탭으로 나누면 지난달 건을 놓치기 쉬워 한 줄로 잇는다. */
export function AbnormalHistoryList({ rows }: { rows: AbnormalInspectionItem[] }) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  if (!rows.length) {
    return <p className="text-muted-foreground py-8 text-center text-sm">이상으로 기록된 점검이 없습니다.</p>;
  }

  // 이미 최신순으로 정렬돼 오므로 이어지는 같은 달끼리 묶기만 하면 된다.
  const groups: { month: string; rows: AbnormalInspectionItem[] }[] = [];
  for (const row of pageRows) {
    const last = groups[groups.length - 1];
    if (last && last.month === row.monthKey) last.rows.push(row);
    else groups.push({ month: row.monthKey, rows: [row] });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        {groups.map((group) => {
          const [year, mm] = group.month.split("-");

          return (
            <section key={group.month}>
              <div className="bg-muted/60 mt-2 rounded-md px-2 py-1.5 text-sm font-semibold first:mt-0">
                {year}년 {Number(mm)}월 ({rows.filter((r) => r.monthKey === group.month).length})
              </div>
              {group.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-2 border-b px-1 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/extinguishers/${row.extinguisherId}`}
                        className="font-mono text-sm font-medium hover:underline"
                      >
                        {row.assetCode}
                      </Link>
                      <StatusBadge row={row} />
                    </div>
                    {row.location && (
                      <p className="text-muted-foreground mt-0.5 text-xs">{row.location}</p>
                    )}
                    <p className="text-destructive mt-1 text-sm">
                      {row.defectItems || "불량항목 없음"}
                      {row.memo ? ` · ${row.memo}` : ""}
                    </p>
                    {row.actionNote && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        조치: {row.actionNote}
                        {row.resolvedAt ? ` (${formatKstDate(row.resolvedAt)})` : ""}
                      </p>
                    )}
                  </div>
                  <div className="text-muted-foreground shrink-0 text-right text-xs">
                    <p>{formatKstDate(row.inspectedAt)}</p>
                    <p>{row.inspectorName}</p>
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

function StatusBadge({ row }: { row: AbnormalInspectionItem }) {
  if (row.resolvedAt) {
    return (
      <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        조치완료
      </span>
    );
  }
  // 조치 없이 다음 점검이 이뤄진 건. 위 "조치 안 된 이상" 목록에는 최근 점검만 올라온다.
  if (row.superseded) {
    return (
      <span className="text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 text-xs font-medium">
        이후 재점검됨
      </span>
    );
  }
  return (
    <span className="bg-destructive/10 text-destructive rounded-md px-1.5 py-0.5 text-xs font-medium">
      조치 안 됨
    </span>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { defectItemsText } from "@/lib/utils/inspection";
import { formatShortLocation } from "@/lib/utils/location";
import type { ExtinguisherOverview } from "@/types/domain";

const PAGE_SIZE = 50;

/** timestamptz → KST 'YYYY-MM-DD' */
function kstDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

/**
 * 이번달 조치완료된 소화기 목록 — 불량항목·불량내용·조치내용을 확인용으로 표시(읽기 전용).
 * 매달 1일 점검이 새로 시작되면 자연히 초기화된다(이번달 조치만 노출).
 */
export function ResolvedActionList({
  rows,
  emptyMessage = "이번달 조치완료된 소화기가 없습니다.",
}: {
  rows: ExtinguisherOverview[];
  emptyMessage?: string;
}) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>관리번호</TableHead>
            <TableHead>위치</TableHead>
            <TableHead>불량항목</TableHead>
            <TableHead>불량내용</TableHead>
            <TableHead>조치내용</TableHead>
            <TableHead>조치일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length ? (
            pageRows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link
                    href={`/extinguishers/${e.id}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {e.asset_code}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatShortLocation(e)}
                </TableCell>
                <TableCell className="text-sm">{defectItemsText(e) || "-"}</TableCell>
                <TableCell className="text-muted-foreground max-w-[12rem] text-sm">
                  {e.last_inspection_memo || "-"}
                </TableCell>
                <TableCell className="max-w-[14rem] text-sm font-medium text-green-700 dark:text-green-500">
                  {e.last_action_note || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {kstDate(e.last_action_resolved_at)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-center">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

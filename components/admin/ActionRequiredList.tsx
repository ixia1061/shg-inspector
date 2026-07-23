"use client";

import Link from "next/link";
import { useState } from "react";

import { ResolveActionDialog } from "@/components/admin/ResolveActionDialog";
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

/** 조치필요(이상+미조치) 소화기 목록 — 불량항목·비고 표시 + 행별 조치 버튼. */
export function ActionRequiredList({
  rows,
  emptyMessage = "조치가 필요한 소화기가 없습니다.",
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
            <TableHead className="text-right">조치</TableHead>
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
                <TableCell className="text-destructive text-sm font-medium">
                  {defectItemsText(e) || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[16rem] text-sm">
                  {e.last_inspection_memo || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <ResolveActionDialog extinguisher={e} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
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

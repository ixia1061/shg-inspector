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
import { formatLocationPath } from "@/lib/utils/location";
import type { ExtinguisherOverview } from "@/types/domain";

const PAGE_SIZE = 50;

/** 소화기 목록(미점검/점검완료 공용) — 페이지당 50개만 렌더(긴 목록 렌더 부담 완화). */
export function UninspectedList({
  rows,
  emptyMessage = "모두 점검 완료되었습니다.",
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length ? (
            pageRows.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/extinguishers/${e.id}`} className="font-mono font-medium hover:underline">
                    {e.asset_code}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatLocationPath(e, { withInstallNote: true })}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={2} className="text-muted-foreground text-center">
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

"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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

/** 미점검 소화기 목록 — 페이지당 50개만 렌더(긴 목록 렌더 부담 완화). */
export function UninspectedList({ rows }: { rows: ExtinguisherOverview[] }) {
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
                모두 점검 완료되었습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
            이전
          </Button>
          <span className="text-muted-foreground text-sm">
            {current + 1} / {pageCount} 페이지
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}

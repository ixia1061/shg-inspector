"use client";

import Link from "next/link";
import { useState } from "react";

import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
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

/** 내용연수 관리 목록 — 페이지당 50개(교체예정일 순은 서버 정렬 유지). */
export function LifecycleList({ rows }: { rows: ExtinguisherOverview[] }) {
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
            <TableHead>제조일</TableHead>
            <TableHead>교체 예정일</TableHead>
            <TableHead>상태</TableHead>
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
                <TableCell className="text-muted-foreground text-sm">{formatLocationPath(e)}</TableCell>
                <TableCell>{e.manufacture_date}</TableCell>
                <TableCell>{e.replace_due_date}</TableCell>
                <TableCell>
                  <LifecycleStatusBadge status={e.lifecycle_status} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                교체가 필요한 소화기가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

"use client";

import Link from "next/link";

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
import { usePagination } from "@/hooks/usePagination";
import { formatShortLocation } from "@/lib/utils/location";
import type { ExtinguisherOverview } from "@/types/domain";

const PAGE_SIZE = 50;

/** 내용연수 관리 목록 — 페이지당 50개(상태 → 관리번호 순 정렬은 서버에서 이미 처리). */
export function LifecycleList({ rows }: { rows: ExtinguisherOverview[] }) {
  // 사업장을 바꾸면 rows 참조가 바뀌어(호출부 useMemo) 1페이지로 자동 복귀한다.
  const { page: current, setPage, pageCount, pageRows } = usePagination(rows, PAGE_SIZE, rows);

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
                {/* 사업장은 상단 버튼으로 이미 선택돼 있으므로 소화기 관리와 같은 짧은 형식으로 표기 */}
                <TableCell className="text-muted-foreground text-sm">{formatShortLocation(e)}</TableCell>
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

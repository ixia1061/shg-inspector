"use client";

import { Button } from "@/components/ui/button";

/** 이전/다음 페이지 이동 컨트롤. pageCount<=1이면 렌더하지 않는다. */
export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
        이전
      </Button>
      <span className="text-muted-foreground text-sm">
        {page + 1} / {pageCount} 페이지
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount - 1}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
    </div>
  );
}

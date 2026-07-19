"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminInspectDialog } from "@/components/admin/AdminInspectDialog";
import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShortLocation } from "@/lib/utils/location";
import { compareAssetCode } from "@/lib/utils/sort";
import type { ExtinguisherListItem, LifecycleStatus, Site } from "@/types/domain";

const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "normal", label: "정상" },
  { value: "due_90", label: "교체 90일 전" },
  { value: "due_30", label: "교체 30일 전" },
  { value: "expired", label: "만료" },
  { value: "none", label: "내용연수 없음" },
];

const PAGE_SIZE = 50;

export function ExtinguisherListClient({
  extinguishers,
  sites,
}: {
  extinguishers: ExtinguisherListItem[];
  sites: Site[];
}) {
  const [siteId, setSiteId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const siteItems = useMemo(
    () => [{ value: "all", label: "전체 사업장" }, ...sites.map((s) => ({ value: s.id, label: s.name }))],
    [sites]
  );

  // 클라이언트에서 즉시 필터 (서버 왕복 없음)
  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return extinguishers
      .filter((e) => {
        if (siteId !== "all" && e.site_id !== siteId) return false;
        if (status !== "all" && e.lifecycle_status !== (status as LifecycleStatus)) return false;
        if (
          kw &&
          !e.asset_code.toLowerCase().includes(kw) &&
          !(e.serial_no ?? "").toLowerCase().includes(kw) &&
          // 위치도 한글로 검색 (건물명/층/설치위치, 차량은 번호판/차종/부서)
          !formatShortLocation(e).toLowerCase().includes(kw)
        )
          return false;
        return true;
      })
      .sort((a, b) => compareAssetCode(a.asset_code, b.asset_code));
  }, [extinguishers, siteId, status, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  // 필터가 바뀌면 첫 페이지로
  function resetPage() {
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="관리번호·제조번호·위치 검색"
          value={search}
          className="w-56"
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
        />
        <Select
          items={siteItems}
          value={siteId}
          onValueChange={(v) => {
            setSiteId(v ?? "all");
            resetPage();
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="사업장" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 사업장</SelectItem>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={STATUS_OPTIONS}
          value={status}
          onValueChange={(v) => {
            setStatus(v ?? "all");
            resetPage();
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground ml-auto text-sm">
          총 {filtered.length}대
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>관리번호</TableHead>
            <TableHead>위치</TableHead>
            <TableHead>종류/제조번호</TableHead>
            <TableHead>내용연수 상태</TableHead>
            <TableHead>최근 점검</TableHead>
            <TableHead className="text-right">점검</TableHead>
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
                <TableCell className="text-muted-foreground text-sm">{formatShortLocation(e)}</TableCell>
                <TableCell>
                  {e.extinguisher_type_name}
                  {e.capacity ? ` (${e.capacity})` : ""}
                  {e.serial_no ? (
                    <div className="text-muted-foreground text-xs">제조번호 {e.serial_no}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <LifecycleStatusBadge status={e.lifecycle_status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {e.last_inspected_at
                    ? new Date(e.last_inspected_at).toLocaleDateString("ko-KR")
                    : "이력 없음"}
                </TableCell>
                <TableCell className="text-right">
                  <AdminInspectDialog extinguisher={e} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-center">
                검색 결과가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

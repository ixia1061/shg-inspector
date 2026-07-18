"use client";

import { Printer, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { QrLabelCard } from "@/components/admin/QrLabelCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildInspectionUrl } from "@/lib/qr/encode";
import { formatShortLocation } from "@/lib/utils/location";
import { compareAssetCode } from "@/lib/utils/sort";
import type { ExtinguisherOverview, LifecycleStatus, Site } from "@/types/domain";

const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "normal", label: "정상" },
  { value: "due_90", label: "교체 90일 전" },
  { value: "due_30", label: "교체 30일 전" },
  { value: "expired", label: "만료" },
  { value: "none", label: "내용연수 없음" },
];

export function QrBulkPrint({
  extinguishers,
  sites,
}: {
  extinguishers: ExtinguisherOverview[];
  sites: Site[];
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [siteId, setSiteId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const siteItems = useMemo(
    () => [{ value: "all", label: "전체 사업장" }, ...sites.map((s) => ({ value: s.id, label: s.name }))],
    [sites]
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return extinguishers
      .filter((e) => {
        if (siteId !== "all" && e.site_id !== siteId) return false;
        if (status !== "all" && e.lifecycle_status !== (status as LifecycleStatus)) return false;
        if (kw && !e.asset_code.toLowerCase().includes(kw)) return false;
        return true;
      })
      .sort((a, b) => compareAssetCode(a.asset_code, b.asset_code));
  }, [extinguishers, siteId, status, search]);

  const selectedRows = useMemo(
    () =>
      extinguishers
        .filter((e) => selected.has(e.id))
        .sort((a, b) => compareAssetCode(a.asset_code, b.asset_code)),
    [extinguishers, selected]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => new Set([...prev, ...filtered.map((e) => e.id)]));
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  return (
    <div className="flex flex-col gap-4">
      {/* 필터/도구 (인쇄물에서는 숨김) */}
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="소화기 관리번호 검색"
            value={search}
            className="w-48"
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select items={siteItems} value={siteId} onValueChange={(v) => setSiteId(v ?? "all")}>
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
          <Select items={STATUS_OPTIONS} value={status} onValueChange={(v) => setStatus(v ?? "all")}>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => startRefresh(() => router.refresh())}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} /> 새로고침
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAllFiltered} disabled={filtered.length === 0}>
            필터 결과 전체 선택 ({filtered.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            선택 해제
          </Button>
          <Button onClick={() => window.print()} disabled={selected.size === 0}>
            <Printer className="size-4" /> 선택 {selected.size}개 QR 인쇄
          </Button>
          <span className="text-muted-foreground ml-auto text-sm">
            선택 {selected.size}개 · 필터 {filtered.length}개
          </span>
        </div>

        {/* 선택 목록 */}
        <div className="max-h-[480px] overflow-y-auto rounded-md border">
          <label className="bg-muted/50 flex items-center gap-3 border-b px-3 py-2 text-sm font-medium">
            <Checkbox
              checked={allFilteredSelected}
              onCheckedChange={(c) => (c === true ? selectAllFiltered() : setSelected(new Set()))}
            />
            <span>관리번호</span>
            <span className="text-muted-foreground">위치</span>
          </label>
          {filtered.length ? (
            filtered.map((e) => (
              <label
                key={e.id}
                className="hover:bg-accent flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-0"
              >
                <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                <span className="w-32 shrink-0 font-mono text-sm font-medium">{e.asset_code}</span>
                <span className="text-muted-foreground truncate text-sm">{formatShortLocation(e)}</span>
              </label>
            ))
          ) : (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">검색 결과가 없습니다.</p>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          체크한 소화기의 QR 라벨이 인쇄됩니다. 소화기를 새로 등록하거나 관리번호가 바뀌면
          &quot;새로고침&quot;을 눌러 최신 목록을 불러오세요.
        </p>
      </div>

      {/* 인쇄 영역: 화면에서는 숨기고 인쇄 시에만 표시 (QR은 미리 생성됨) */}
      <div id="print-area" className="hidden grid-cols-3 gap-3 print:grid">
        {selectedRows.map((e) => (
          <QrLabelCard
            key={e.id}
            url={buildInspectionUrl(e.asset_code)}
            code={e.asset_code}
            location={formatShortLocation(e)}
          />
        ))}
      </div>
    </div>
  );
}

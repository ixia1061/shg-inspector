"use client";

import { useMemo } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Site } from "@/types/domain";

const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "normal", label: "정상" },
  { value: "due_90", label: "교체 90일 전" },
  { value: "due_30", label: "교체 30일 전" },
  { value: "expired", label: "만료" },
];

export function ExtinguisherFilters({ sites }: { sites: Site[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const siteItems = useMemo(
    () => [
      { value: "all", label: "전체 사업장" },
      ...sites.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sites]
  );

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/extinguishers?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="소화기 관리번호 검색"
        defaultValue={searchParams.get("asset_code") ?? ""}
        className="w-48"
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) params.set("asset_code", e.target.value);
          else params.delete("asset_code");
          router.push(`/extinguishers?${params.toString()}`);
        }}
      />
      <Select
        items={siteItems}
        defaultValue={searchParams.get("site_id") ?? "all"}
        onValueChange={(v) => updateParam("site_id", v)}
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
        defaultValue={searchParams.get("status") ?? "all"}
        onValueChange={(v) => updateParam("status", v)}
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
    </div>
  );
}

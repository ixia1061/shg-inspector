"use client";

import { useMemo, useState } from "react";

import { LifecycleList } from "@/components/admin/LifecycleList";
import { Button } from "@/components/ui/button";
import type { ExtinguisherOverview, Site } from "@/types/domain";

/**
 * 내용연수 관리 — 점검현황·수량현황과 동일하게 상단 사업장 버튼으로 전환한다.
 * 버튼 순서는 관리자 개인 설정(내 계정 → 사업장 표시 순서)을 따르며, 서버에서 이미 정렬해 넘긴다.
 */
export function LifecycleClient({
  extinguishers,
  sites,
}: {
  extinguishers: ExtinguisherOverview[];
  sites: Site[];
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");

  const rows = useMemo(
    () => extinguishers.filter((e) => e.site_id === siteId),
    [extinguishers, siteId]
  );

  // 사업장별 건수를 버튼에 함께 표시해 어디에 교체 대상이 몰려 있는지 바로 보이게 한다.
  const countBySite = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of extinguishers) map.set(e.site_id, (map.get(e.site_id) ?? 0) + 1);
    return map;
  }, [extinguishers]);

  const expired = rows.filter((e) => e.lifecycle_status === "expired").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sites.map((s) => (
          <Button
            key={s.id}
            variant={s.id === siteId ? "default" : "outline"}
            size="sm"
            onClick={() => setSiteId(s.id)}
          >
            {s.name}
            <span className="text-muted-foreground ml-1.5 text-xs">
              {countBySite.get(s.id) ?? 0}
            </span>
          </Button>
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        교체 대상 {rows.length}대
        {expired > 0 ? ` · 이미 만료 ${expired}대` : ""}
      </p>

      <LifecycleList rows={rows} />
    </div>
  );
}

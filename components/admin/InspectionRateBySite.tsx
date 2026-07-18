"use client";

import { useMemo, useState } from "react";

import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { Button } from "@/components/ui/button";
import type { ExtinguisherOverview, InspectionRateRow, Site } from "@/types/domain";

/** 건물별 이번달 점검률을 사업장 버튼으로 나눠 보고, 건물번호 순으로 정렬해 표시한다. */
export function InspectionRateBySite({
  extinguishers,
  sites,
}: {
  extinguishers: ExtinguisherOverview[];
  sites: Site[];
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");

  const rows: InspectionRateRow[] = useMemo(() => {
    const map = new Map<
      string,
      { group_id: string; group_name: string; building_no: number; total: number; inspected: number }
    >();
    for (const e of extinguishers) {
      if (e.site_id !== siteId) continue;
      const key = String(e.building_id);
      let g = map.get(key);
      if (!g) {
        g = {
          group_id: key,
          group_name: `${e.building_no}동 ${e.building_name ?? ""}`.trim(),
          building_no: e.building_no ?? 0,
          total: 0,
          inspected: 0,
        };
        map.set(key, g);
      }
      g.total++;
      if (e.inspected_this_month) g.inspected++;
    }
    return [...map.values()]
      .sort((a, b) => a.building_no - b.building_no)
      .map((g) => ({
        group_id: g.group_id,
        group_name: g.group_name,
        total: g.total,
        inspected: g.inspected,
        rate: g.total ? Math.round((1000 * g.inspected) / g.total) / 10 : 0,
      }));
  }, [extinguishers, siteId]);

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
          </Button>
        ))}
      </div>
      <InspectionRateChart rows={rows} />
    </div>
  );
}

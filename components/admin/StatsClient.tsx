"use client";

import { useMemo, useState } from "react";

import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { ALL_SITES, SiteFilterButtons } from "@/components/admin/SiteFilterButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildingInspectionRates } from "@/lib/utils/dashboard";
import type { ExtinguisherOverview, Site } from "@/types/domain";

/** 이번달 점검 1건 — 사업장별 실적 집계를 위해 소화기의 사업장을 미리 붙여 넘긴다. */
export interface MonthInspection {
  inspector_id: string;
  inspector_name: string;
  site_id: string | null;
  abnormal: boolean;
}

/**
 * 통계 — 대시보드와 동일하게 사업장별로 나눠 본다.
 * 여러 사업장을 담당하면 건물별 점검률에 같은 이름의 건물이 섞여 구분이 어렵다.
 */
export function StatsClient({
  extinguishers,
  sites,
  monthInspections,
}: {
  extinguishers: ExtinguisherOverview[];
  sites: Site[];
  monthInspections: MonthInspection[];
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? ALL_SITES);

  const rows = useMemo(
    () => (siteId === ALL_SITES ? extinguishers : extinguishers.filter((e) => e.site_id === siteId)),
    [extinguishers, siteId]
  );

  const rateRows = useMemo(
    () => buildingInspectionRates(rows, { withSiteName: siteId === ALL_SITES }),
    [rows, siteId]
  );

  const inspections = useMemo(
    () =>
      siteId === ALL_SITES
        ? monthInspections
        : monthInspections.filter((i) => i.site_id === siteId),
    [monthInspections, siteId]
  );

  const byInspector = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of inspections) map.set(i.inspector_name, (map.get(i.inspector_name) ?? 0) + 1);
    return [...map].sort((a, b) => b[1] - a[1]);
  }, [inspections]);

  const total = inspections.length;
  const abnormal = inspections.filter((i) => i.abnormal).length;
  const abnormalRate = total > 0 ? Math.round((abnormal / total) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-6">
      <SiteFilterButtons sites={sites} value={siteId} onChange={setSiteId} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>건물별 이번달 점검률</CardTitle>
          </CardHeader>
          <CardContent>
            <InspectionRateChart rows={rateRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>이번달 점검자별 실적</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-sm">
              이번달 총 {total}건 · 이상점검 비율 {abnormalRate}%
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {byInspector.map(([name, count]) => (
                <li key={name} className="flex justify-between border-b pb-1 last:border-0">
                  <span>{name}</span>
                  <span className="font-medium">{count}건</span>
                </li>
              ))}
              {total === 0 && (
                <li className="text-muted-foreground">이번달 점검 이력이 없습니다.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

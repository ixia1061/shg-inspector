"use client";

import { useMemo, useState } from "react";

import { ActionRequiredList } from "@/components/admin/ActionRequiredList";
import { DashboardCards } from "@/components/admin/DashboardCards";
import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { ResolvedActionList } from "@/components/admin/ResolvedActionList";
import { ALL_SITES, SiteFilterButtons } from "@/components/admin/SiteFilterButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildingInspectionRates, summarizeExtinguishers } from "@/lib/utils/dashboard";
import { isActionNeeded, isActionResolved } from "@/lib/utils/inspection";
import { sortByAssetCode } from "@/lib/utils/sort";
import type { ExtinguisherOverview, Site } from "@/types/domain";

/**
 * 대시보드 — 사업장별로 나눠 본다.
 * 여러 사업장을 담당하는 관리자는 전부 합쳐 보면 건물명이 겹쳐(관리동·동력동 등) 구분이 어렵다.
 * 기본 선택은 첫 사업장(개인 설정 순서 기준), 필요하면 "전체"로 합쳐 볼 수 있다.
 */
export function DashboardClient({
  extinguishers,
  sites,
  recentAbnormalSiteIds,
}: {
  extinguishers: ExtinguisherOverview[];
  sites: Site[];
  /** 최근 30일 이상 점검의 사업장 id 목록(점검 1건당 1개) — 사업장별 카운트에 사용 */
  recentAbnormalSiteIds: string[];
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? ALL_SITES);

  const rows = useMemo(
    () => (siteId === ALL_SITES ? extinguishers : extinguishers.filter((e) => e.site_id === siteId)),
    [extinguishers, siteId]
  );

  const recentAbnormal = useMemo(
    () =>
      siteId === ALL_SITES
        ? recentAbnormalSiteIds.length
        : recentAbnormalSiteIds.filter((id) => id === siteId).length,
    [recentAbnormalSiteIds, siteId]
  );

  const summary = useMemo(
    () => summarizeExtinguishers(rows, recentAbnormal),
    [rows, recentAbnormal]
  );

  const rateRows = useMemo(
    () => buildingInspectionRates(rows, { withSiteName: siteId === ALL_SITES }),
    [rows, siteId]
  );

  const actionNeeded = useMemo(() => sortByAssetCode(rows.filter(isActionNeeded)), [rows]);
  const actionResolved = useMemo(() => sortByAssetCode(rows.filter(isActionResolved)), [rows]);

  // 사업장 버튼에 미점검 수를 붙여 어디가 급한지 바로 보이게 한다.
  const uninspectedBySite = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of extinguishers) {
      if (!e.inspected_this_month) map.set(e.site_id, (map.get(e.site_id) ?? 0) + 1);
    }
    return map;
  }, [extinguishers]);

  return (
    <div className="flex flex-col gap-6">
      <SiteFilterButtons
        sites={sites}
        value={siteId}
        onChange={setSiteId}
        counts={uninspectedBySite}
      />
      <p className="text-muted-foreground -mt-3 text-xs">사업장 버튼의 숫자는 이번달 미점검 수입니다.</p>

      <DashboardCards summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>건물별 이번달 점검률</CardTitle>
          </CardHeader>
          <CardContent>
            <InspectionRateChart rows={rateRows} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>조치 필요 소화기 ({actionNeeded.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionRequiredList rows={actionNeeded} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>조치완료 소화기 ({actionResolved.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ResolvedActionList rows={actionResolved} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

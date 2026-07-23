"use client";

import { useMemo, useState } from "react";

import { ActionRequiredList } from "@/components/admin/ActionRequiredList";
import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { LedgerDownloadButton } from "@/components/admin/LedgerDownloadButton";
import { ResolvedActionList } from "@/components/admin/ResolvedActionList";
import { UninspectedList } from "@/components/admin/UninspectedList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isActionNeeded, isActionResolved, isMonthDone, isNormalDone } from "@/lib/utils/inspection";
import { sortByAssetCode } from "@/lib/utils/sort";
import type { ExtinguisherOverview, InspectionRateRow, Site } from "@/types/domain";

/**
 * 점검현황 전체를 사업장 선택으로 구동한다. 사업장 버튼을 누르면
 * 건물별 점검률·이번달 미점검·점검완료 목록·관리대장 다운로드가 모두 그 사업장으로 한정된다.
 */
export function InspectionStatusClient({
  extinguishers,
  sites,
}: {
  extinguishers: ExtinguisherOverview[];
  sites: Site[];
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");

  const siteRows = useMemo(
    () => extinguishers.filter((e) => e.site_id === siteId),
    [extinguishers, siteId],
  );

  // 건물별 이번달 점검률 (건물번호 순)
  const rateRows: InspectionRateRow[] = useMemo(() => {
    const map = new Map<
      string,
      { group_id: string; group_name: string; building_no: number; total: number; inspected: number }
    >();
    for (const e of siteRows) {
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
      // 조치필요(이상+미조치)는 미완료로 집계 → 완료만 카운트
      if (isMonthDone(e)) g.inspected++;
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
  }, [siteRows]);

  const notMonth = useMemo(
    () => sortByAssetCode(siteRows.filter((r) => !r.inspected_this_month)),
    [siteRows],
  );
  const actionNeeded = useMemo(
    () => sortByAssetCode(siteRows.filter((r) => isActionNeeded(r))),
    [siteRows],
  );
  const actionResolved = useMemo(
    () => sortByAssetCode(siteRows.filter((r) => isActionResolved(r))),
    [siteRows],
  );
  // 점검완료 탭은 "정상 점검완료"만(조치완료는 별도 탭). 점검률(isMonthDone)은 둘 다 완료로 집계.
  const doneMonth = useMemo(
    () => sortByAssetCode(siteRows.filter((r) => isNormalDone(r))),
    [siteRows],
  );

  const selectedSite = sites.find((s) => s.id === siteId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        {selectedSite ? <LedgerDownloadButton site={selectedSite} /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>건물별 이번달 점검률</CardTitle>
        </CardHeader>
        <CardContent>
          <InspectionRateChart rows={rateRows} />
        </CardContent>
      </Card>

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">이번달 미점검 ({notMonth.length})</TabsTrigger>
          <TabsTrigger value="action">조치필요 ({actionNeeded.length})</TabsTrigger>
          <TabsTrigger value="resolved">조치완료 ({actionResolved.length})</TabsTrigger>
          <TabsTrigger value="done">점검완료 ({doneMonth.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="month">
          <UninspectedList rows={notMonth} />
        </TabsContent>
        <TabsContent value="action">
          <ActionRequiredList rows={actionNeeded} />
        </TabsContent>
        <TabsContent value="resolved">
          <ResolvedActionList rows={actionResolved} />
        </TabsContent>
        <TabsContent value="done">
          <UninspectedList rows={doneMonth} emptyMessage="이번달 정상 점검완료된 소화기가 없습니다." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

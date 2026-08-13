"use client";

import { useMemo, useState } from "react";

import { AbnormalHistoryList, type AbnormalInspectionItem } from "@/components/admin/AbnormalHistoryList";
import { ActionRequiredList } from "@/components/admin/ActionRequiredList";
import { BackButton } from "@/components/shared/BackButton";
import { ALL_SITES, SiteFilterButtons } from "@/components/admin/SiteFilterButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isActionNeeded } from "@/lib/utils/inspection";
import { sortByAssetCode } from "@/lib/utils/sort";
import type { ExtinguisherOverview, Site } from "@/types/domain";

/**
 * 이상점검 화면.
 * - 위: 조치 안 된 이상 (달과 무관 — 지난달 것도 끝날 때까지 남는다)
 * - 아래: 이상점검 이력 (월 헤더로 구분, 최신순)
 *
 * 월별 탭으로 나누지 않은 이유: 지난달에 이상이 났는데 이번달에 아직 점검하지 않은 소화기가
 * "이번달" 탭에서 통째로 사라져, 정작 놓치면 안 되는 건이 안 보이게 된다.
 */
export function AbnormalClient({
  extinguishers,
  history,
  sites,
  initialSiteId,
}: {
  extinguishers: ExtinguisherOverview[];
  history: AbnormalInspectionItem[];
  sites: Site[];
  /** 대시보드 카드에서 넘어온 사업장("all"이면 전체). 담당 범위 밖이면 첫 사업장으로 연다. */
  initialSiteId?: string;
}) {
  const [siteId, setSiteId] = useState(
    initialSiteId === ALL_SITES || sites.some((s) => s.id === initialSiteId)
      ? initialSiteId!
      : (sites[0]?.id ?? ALL_SITES)
  );

  const unresolved = useMemo(() => {
    const rows = extinguishers.filter(
      (e) => isActionNeeded(e) && (siteId === ALL_SITES || e.site_id === siteId)
    );
    return sortByAssetCode(rows);
  }, [extinguishers, siteId]);

  const rows = useMemo(
    () => (siteId === ALL_SITES ? history : history.filter((h) => h.siteId === siteId)),
    [history, siteId]
  );

  // 사업장 버튼에 미조치 수를 붙여 어디가 급한지 바로 보이게 한다.
  const unresolvedBySite = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of extinguishers) {
      if (isActionNeeded(e)) map.set(e.site_id, (map.get(e.site_id) ?? 0) + 1);
    }
    return map;
  }, [extinguishers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SiteFilterButtons
          sites={sites}
          value={siteId}
          onChange={setSiteId}
          counts={unresolvedBySite}
        />
        <BackButton />
      </div>
      <p className="text-muted-foreground -mt-3 text-xs">사업장 버튼의 숫자는 조치 안 된 이상 수입니다.</p>

      <Card>
        <CardHeader>
          <CardTitle>조치 안 된 이상 ({unresolved.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            점검한 달과 상관없이 <b>조치를 마칠 때까지</b> 남습니다. [조치]를 눌러 조치내용을 적으면
            그 달 점검완료로 집계됩니다.
          </p>
          <ActionRequiredList rows={unresolved} emptyMessage="조치가 필요한 소화기가 없습니다." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>이상점검 이력 ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <AbnormalHistoryList rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

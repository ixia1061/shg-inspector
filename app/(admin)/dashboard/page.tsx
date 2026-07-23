import { ActionRequiredList } from "@/components/admin/ActionRequiredList";
import { DashboardCards } from "@/components/admin/DashboardCards";
import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isActionNeeded } from "@/lib/utils/inspection";
import { createClient } from "@/lib/supabase/server";
import { sortByAssetCode } from "@/lib/utils/sort";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: summaryRows }, { data: rateRows }, { data: overviewRows }] = await Promise.all([
    supabase.rpc("fn_dashboard_summary"),
    supabase.rpc("fn_inspection_rate", { p_group_by: "building", p_period: "month" }),
    supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
  ]);

  // 건물별 점검률은 건물명 가나다순으로 정렬해 표시한다.
  const rateRowsSorted = [...(rateRows ?? [])].sort((a, b) =>
    (a.group_name ?? "").localeCompare(b.group_name ?? "", "ko"),
  );

  // 조치필요(이상+미조치) 소화기 목록
  const actionNeeded = sortByAssetCode((overviewRows ?? []).filter((r) => isActionNeeded(r)));

  const summary = summaryRows?.[0] ?? {
    total_extinguishers: 0,
    inspected_this_month: 0,
    not_inspected_this_month: 0,
    action_required: 0,
    due_soon: 0,
    expired: 0,
    recent_abnormal: 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <DashboardCards summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>건물별 이번달 점검률</CardTitle>
          </CardHeader>
          <CardContent>
            <InspectionRateChart rows={rateRowsSorted} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>조치 필요 소화기 ({actionNeeded.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionRequiredList rows={actionNeeded} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

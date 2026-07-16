import { DashboardCards } from "@/components/admin/DashboardCards";
import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: summaryRows }, { data: rateRows }, { data: abnormalInspections }] =
    await Promise.all([
      supabase.rpc("fn_dashboard_summary"),
      supabase.rpc("fn_inspection_rate", { p_group_by: "building", p_period: "month" }),
      supabase
        .from("inspections")
        .select("id, inspected_at, memo, extinguishers(asset_code)")
        .eq("overall_result", "abnormal")
        .order("inspected_at", { ascending: false })
        .limit(5),
    ]);

  const summary = summaryRows?.[0] ?? {
    total_extinguishers: 0,
    inspected_today: 0,
    not_inspected_today: 0,
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
            <InspectionRateChart rows={rateRows ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 이상점검</CardTitle>
          </CardHeader>
          <CardContent>
            {!abnormalInspections || abnormalInspections.length === 0 ? (
              <p className="text-muted-foreground text-sm">최근 이상점검 이력이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {abnormalInspections.map((row) => (
                  <li key={row.id} className="flex flex-col border-b pb-2 last:border-0">
                    <span className="font-mono font-medium">
                      {(row.extinguishers as unknown as { asset_code: string } | null)?.asset_code ?? "-"}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(row.inspected_at).toLocaleString("ko-KR")}
                      {row.memo ? ` · ${row.memo}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

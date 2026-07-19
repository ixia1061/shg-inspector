import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function StatsPage() {
  const supabase = await createClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ data: buildingRate }, { data: monthInspections }] = await Promise.all([
    // 구역(zone)은 실데이터에 거의 없어 건물 단위로 집계한다. (대시보드·점검현황과 동일)
    supabase.rpc("fn_inspection_rate", { p_group_by: "building", p_period: "month" }),
    supabase
      .from("inspections")
      .select("inspector_id, overall_result")
      .gte("inspected_at", startOfMonth.toISOString()),
  ]);

  // 이름 있는 건물만, 건물명 가나다순 정렬
  const rateRows = [...(buildingRate ?? [])]
    .filter((r) => r.group_name)
    .sort((a, b) => (a.group_name ?? "").localeCompare(b.group_name ?? "", "ko"));

  const inspectorIds = [...new Set((monthInspections ?? []).map((i) => i.inspector_id))];
  const { data: inspectors } = inspectorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", inspectorIds)
    : { data: [] };
  const inspectorNameById = new Map((inspectors ?? []).map((p) => [p.id, p.name]));

  const countByInspector = (monthInspections ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.inspector_id] = (acc[i.inspector_id] ?? 0) + 1;
    return acc;
  }, {});

  const totalThisMonth = monthInspections?.length ?? 0;
  const abnormalThisMonth = (monthInspections ?? []).filter((i) => i.overall_result === "abnormal").length;
  const abnormalRate = totalThisMonth > 0 ? Math.round((abnormalThisMonth / totalThisMonth) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">통계</h1>

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
              이번달 총 {totalThisMonth}건 · 이상점검 비율 {abnormalRate}%
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {Object.entries(countByInspector)
                .sort((a, b) => b[1] - a[1])
                .map(([inspectorId, count]) => (
                  <li key={inspectorId} className="flex justify-between border-b pb-1 last:border-0">
                    <span>{inspectorNameById.get(inspectorId) ?? "알 수 없음"}</span>
                    <span className="font-medium">{count}건</span>
                  </li>
                ))}
              {totalThisMonth === 0 && (
                <li className="text-muted-foreground">이번달 점검 이력이 없습니다.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

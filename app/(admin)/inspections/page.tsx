import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { UninspectedList } from "@/components/admin/UninspectedList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sortByAssetCode } from "@/lib/utils/sort";
import { createClient } from "@/lib/supabase/server";

export default async function InspectionsPage() {
  const supabase = await createClient();

  const [{ data: notTodayRows }, { data: notMonthRows }, { data: buildingRate }] =
    await Promise.all([
      supabase.from("v_extinguisher_overview").select("*").eq("inspected_today", false),
      supabase.from("v_extinguisher_overview").select("*").eq("inspected_this_month", false),
      supabase.rpc("fn_inspection_rate", { p_group_by: "building", p_period: "month" }),
    ]);

  const notToday = sortByAssetCode(notTodayRows ?? []);
  const notMonth = sortByAssetCode(notMonthRows ?? []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">점검현황</h1>

      <Card>
        <CardHeader>
          <CardTitle>건물별 이번달 점검률</CardTitle>
        </CardHeader>
        <CardContent>
          <InspectionRateChart rows={buildingRate ?? []} />
        </CardContent>
      </Card>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">오늘 미점검 ({notToday.length})</TabsTrigger>
          <TabsTrigger value="month">이번달 미점검 ({notMonth.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <UninspectedList rows={notToday} />
        </TabsContent>
        <TabsContent value="month">
          <UninspectedList rows={notMonth} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

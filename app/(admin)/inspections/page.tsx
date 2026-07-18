import { InspectionRateBySite } from "@/components/admin/InspectionRateBySite";
import { LedgerDownloadButton } from "@/components/admin/LedgerDownloadButton";
import { UninspectedList } from "@/components/admin/UninspectedList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sortByAssetCode } from "@/lib/utils/sort";
import { createClient } from "@/lib/supabase/server";

export default async function InspectionsPage() {
  const supabase = await createClient();

  // 점검 여부(오늘/이번달)가 필요하므로 overview 뷰를 쓴다. 한 번만 불러와
  // 미점검 목록과 건물별 점검률을 모두 계산한다.
  const [{ data: rows }, { data: sites }] = await Promise.all([
    supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
    supabase.from("sites").select("*").order("name"),
  ]);

  const all = rows ?? [];
  const notToday = sortByAssetCode(all.filter((r) => !r.inspected_today));
  const notMonth = sortByAssetCode(all.filter((r) => !r.inspected_this_month));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">점검현황</h1>
        <LedgerDownloadButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>건물별 이번달 점검률</CardTitle>
        </CardHeader>
        <CardContent>
          <InspectionRateBySite extinguishers={all} sites={sites ?? []} />
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

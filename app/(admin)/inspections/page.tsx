import Link from "next/link";

import { InspectionRateChart } from "@/components/admin/InspectionRateChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";

function UninspectedTable({
  rows,
}: {
  rows: { id: string; code: string; site_name: string; building_name: string; floor_name: string; zone_name: string | null }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>관리번호</TableHead>
          <TableHead>위치</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <Link href={`/extinguishers/${e.id}`} className="font-medium hover:underline">
                  {e.code}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {[e.site_name, e.building_name, e.floor_name, e.zone_name].filter(Boolean).join(" > ")}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={2} className="text-muted-foreground text-center">
              모두 점검 완료되었습니다.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default async function InspectionsPage() {
  const supabase = await createClient();

  const [{ data: notTodayRows }, { data: notMonthRows }, { data: buildingRate }, { data: floorRate }] =
    await Promise.all([
      supabase.from("v_extinguisher_overview").select("*").eq("inspected_today", false).order("code"),
      supabase.from("v_extinguisher_overview").select("*").eq("inspected_this_month", false).order("code"),
      supabase.rpc("fn_inspection_rate", { p_group_by: "building", p_period: "month" }),
      supabase.rpc("fn_inspection_rate", { p_group_by: "floor", p_period: "month" }),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">점검현황</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>건물별 이번달 점검률</CardTitle>
          </CardHeader>
          <CardContent>
            <InspectionRateChart rows={buildingRate ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>층별 이번달 점검률</CardTitle>
          </CardHeader>
          <CardContent>
            <InspectionRateChart rows={floorRate ?? []} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">오늘 미점검 ({notTodayRows?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="month">이번달 미점검 ({notMonthRows?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <UninspectedTable rows={notTodayRows ?? []} />
        </TabsContent>
        <TabsContent value="month">
          <UninspectedTable rows={notMonthRows ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

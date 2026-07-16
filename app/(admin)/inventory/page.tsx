import { Building2, Car, FireExtinguisher, Shapes } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { ExtinguisherOverview } from "@/types/domain";

interface PivotRow {
  key: string;
  label: string;
  countsByType: Record<string, number>;
  total: number;
}

/** 건물(또는 차량) 단위 행으로 묶고, 종류별 열 개수를 집계한 피벗 데이터를 만든다. */
function buildPivot(rows: ExtinguisherOverview[]) {
  const typeNames = [...new Set(rows.map((r) => r.extinguisher_type_name))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  const rowMap = new Map<string, PivotRow>();

  for (const r of rows) {
    const key =
      r.location_type === "BUILDING" ? `b:${r.building_id}` : `v:${r.vehicle_id}`;
    const label =
      r.location_type === "BUILDING"
        ? `${r.site_name} ${r.building_no}동${r.building_name ? ` (${r.building_name})` : ""}`
        : `${r.site_name} 차량 ${r.vehicle_no}호${r.vehicle_name ? ` (${r.vehicle_name})` : ""}`;

    let row = rowMap.get(key);
    if (!row) {
      row = { key, label, countsByType: {}, total: 0 };
      rowMap.set(key, row);
    }
    row.countsByType[r.extinguisher_type_name] =
      (row.countsByType[r.extinguisher_type_name] ?? 0) + 1;
    row.total += 1;
  }

  const pivotRows = [...rowMap.values()].sort((a, b) => a.label.localeCompare(b.label, "ko"));

  const totalsByType: Record<string, number> = {};
  for (const t of typeNames) {
    totalsByType[t] = pivotRows.reduce((sum, row) => sum + (row.countsByType[t] ?? 0), 0);
  }
  const grandTotal = pivotRows.reduce((sum, row) => sum + row.total, 0);

  return { typeNames, pivotRows, totalsByType, grandTotal };
}

export default async function InventoryPage() {
  const supabase = await createClient();

  const { data: extinguishers } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("status", "active");

  const rows = extinguishers ?? [];
  const { typeNames, pivotRows, totalsByType, grandTotal } = buildPivot(rows);

  const buildingCount = new Set(
    rows.filter((r) => r.location_type === "BUILDING").map((r) => r.building_id)
  ).size;
  const vehicleCount = new Set(
    rows.filter((r) => r.location_type === "VEHICLE").map((r) => r.vehicle_id)
  ).size;

  const summaryCards = [
    { label: "총 소화기", value: grandTotal, icon: FireExtinguisher },
    { label: "설치 건물", value: buildingCount, icon: Building2 },
    { label: "설치 차량", value: vehicleCount, icon: Car },
    { label: "소화기 종류", value: typeNames.length, icon: Shapes },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">수량 현황</h1>
        <p className="text-muted-foreground text-sm">
          사용 중(active)인 소화기의 건물·차량별 / 종류별 수량입니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
              <Icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>건물·차량별 × 종류별 수량</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">위치</TableHead>
                {typeNames.map((t) => (
                  <TableHead key={t} className="text-right">
                    {t}
                  </TableHead>
                ))}
                <TableHead className="text-right font-bold">합계</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pivotRows.length ? (
                <>
                  {pivotRows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      {typeNames.map((t) => (
                        <TableCell key={t} className="text-right">
                          {row.countsByType[t] ?? "-"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold">{row.total}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-bold">전체</TableCell>
                    {typeNames.map((t) => (
                      <TableCell key={t} className="text-right font-bold">
                        {totalsByType[t]}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">{grandTotal}</TableCell>
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={typeNames.length + 2}
                    className="text-muted-foreground text-center"
                  >
                    등록된 소화기가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

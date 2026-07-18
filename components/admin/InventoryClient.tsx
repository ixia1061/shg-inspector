"use client";

import { Building2, Car, FireExtinguisher, Shapes } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExtinguisherListItem, Site } from "@/types/domain";

interface PivotRow {
  key: string;
  label: string;
  countsByType: Record<string, number>;
  total: number;
}

/** 선택된 사업장의 소화기를 건물 단위 행 × 종류 열로 집계한다. 차량 소화기도 소속 건물에 포함. */
function buildPivot(rows: ExtinguisherListItem[]) {
  const typeNames = [...new Set(rows.map((r) => r.extinguisher_type_name))].sort((a, b) =>
    a.localeCompare(b, "ko")
  );

  const rowMap = new Map<string, PivotRow>();
  for (const r of rows) {
    const key = `b:${r.building_id}`;
    // 사업장이 이미 선택되어 있으므로 라벨에는 건물만 표기한다.
    const label = `${r.building_no}동${r.building_name ? ` (${r.building_name})` : ""}`;
    let row = rowMap.get(key);
    if (!row) {
      row = { key, label, countsByType: {}, total: 0 };
      rowMap.set(key, row);
    }
    row.countsByType[r.extinguisher_type_name] =
      (row.countsByType[r.extinguisher_type_name] ?? 0) + 1;
    row.total += 1;
  }

  const pivotRows = [...rowMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "ko", { numeric: true })
  );

  const totalsByType: Record<string, number> = {};
  for (const t of typeNames) {
    totalsByType[t] = pivotRows.reduce((sum, row) => sum + (row.countsByType[t] ?? 0), 0);
  }
  const grandTotal = pivotRows.reduce((sum, row) => sum + row.total, 0);

  return { typeNames, pivotRows, totalsByType, grandTotal };
}

export function InventoryClient({
  extinguishers,
  sites,
}: {
  extinguishers: ExtinguisherListItem[];
  sites: Site[];
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");

  const rows = useMemo(
    () => extinguishers.filter((r) => r.site_id === siteId),
    [extinguishers, siteId]
  );

  const { typeNames, pivotRows, totalsByType, grandTotal } = useMemo(() => buildPivot(rows), [rows]);

  const buildingCount = useMemo(() => new Set(rows.map((r) => r.building_id)).size, [rows]);
  const vehicleCount = useMemo(
    () => new Set(rows.filter((r) => r.location_type === "VEHICLE").map((r) => r.vehicle_id)).size,
    [rows]
  );

  const summaryCards = [
    { label: "총 소화기", value: grandTotal, icon: FireExtinguisher },
    { label: "설치 건물", value: buildingCount, icon: Building2 },
    { label: "설치 차량", value: vehicleCount, icon: Car },
    { label: "소화기 종류", value: typeNames.length, icon: Shapes },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 사업장 선택 버튼 */}
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
          <CardTitle>건물별 × 종류별 수량 (차량 포함)</CardTitle>
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

import Link from "next/link";

import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLocationPath } from "@/lib/utils/location";
import { createClient } from "@/lib/supabase/server";
import type { ExtinguisherOverview } from "@/types/domain";

/** 목록 한 줄 — 누르면 해당 소화기의 점검 화면으로 바로 이동한다. */
function ExtinguisherRow({ row }: { row: ExtinguisherOverview }) {
  return (
    <Link
      href={`/inspect/${encodeURIComponent(row.asset_code)}`}
      className="hover:bg-accent flex items-center justify-between gap-2 border-b px-1 py-3 last:border-0"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-medium">{row.asset_code}</p>
        <p className="text-muted-foreground truncate text-xs">{formatLocationPath(row)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <LifecycleStatusBadge status={row.lifecycle_status} />
        <span className="text-muted-foreground text-xs">
          {row.last_inspected_at
            ? new Date(row.last_inspected_at).toLocaleDateString("ko-KR")
            : "점검이력 없음"}
        </span>
      </div>
    </Link>
  );
}

export default async function InspectorStatusPage() {
  const supabase = await createClient();

  // RLS가 담당 사업장 데이터만 반환하므로 별도 필터가 필요 없다.
  const { data: extinguishers } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("status", "active")
    .order("asset_code");

  const rows = extinguishers ?? [];
  const notInspected = rows.filter((r) => !r.inspected_this_month);
  const inspected = rows.length - notInspected.length;
  const lifecycleAlerts = rows.filter((r) =>
    ["due_90", "due_30", "expired"].includes(r.lifecycle_status)
  );

  // 건물별 수량 (차량 소화기도 소속 건물에 포함)
  const byBuilding = new Map<string, { label: string; count: number }>();
  for (const r of rows) {
    const key = String(r.building_id);
    const entry = byBuilding.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      byBuilding.set(key, {
        label: `${r.site_name} ${r.building_no}동${r.building_name ? ` (${r.building_name})` : ""}`,
        count: 1,
      });
    }
  }
  const buildingCounts = [...byBuilding.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "ko")
  );

  const summaryCards = [
    { label: "총 소화기", value: rows.length },
    { label: "이번달 점검", value: inspected },
    { label: "이번달 미점검", value: notInspected.length, tone: "warning" as const },
    { label: "교체 필요", value: lifecycleAlerts.length, tone: "destructive" as const },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">점검 현황</h1>

      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map(({ label, value, tone }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p
                className={`text-2xl font-bold ${
                  tone === "warning"
                    ? "text-amber-600 dark:text-amber-400"
                    : tone === "destructive"
                      ? "text-destructive"
                      : ""
                }`}
              >
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTrigger value="pending">미점검 ({notInspected.length})</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="counts">수량</TabsTrigger>
          <TabsTrigger value="lifecycle">연수 ({lifecycleAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {notInspected.length ? (
            <div>
              <p className="text-muted-foreground px-1 py-2 text-xs">
                항목을 누르면 바로 점검 화면으로 이동합니다.
              </p>
              {notInspected.map((row) => (
                <ExtinguisherRow key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              이번달 점검이 모두 완료되었습니다. 🎉
            </p>
          )}
        </TabsContent>

        <TabsContent value="all">
          {rows.map((row) => (
            <ExtinguisherRow key={row.id} row={row} />
          ))}
          {rows.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              등록된 소화기가 없습니다.
            </p>
          )}
        </TabsContent>

        <TabsContent value="counts">
          <ul className="flex flex-col">
            {buildingCounts.map(({ label, count }) => (
              <li key={label} className="flex items-center justify-between border-b px-1 py-3 text-sm last:border-0">
                <span>{label}</span>
                <span className="font-bold">{count}대</span>
              </li>
            ))}
            <li className="flex items-center justify-between px-1 py-3 text-sm font-bold">
              <span>전체</span>
              <span>{rows.length}대</span>
            </li>
          </ul>
        </TabsContent>

        <TabsContent value="lifecycle">
          {lifecycleAlerts.length ? (
            lifecycleAlerts.map((row) => <ExtinguisherRow key={row.id} row={row} />)
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              교체가 필요한 소화기가 없습니다.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

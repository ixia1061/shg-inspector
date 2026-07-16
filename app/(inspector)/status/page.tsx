import { QrCode } from "lucide-react";
import Link from "next/link";

import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLocationPath } from "@/lib/utils/location";
import { createClient } from "@/lib/supabase/server";
import type { ExtinguisherOverview } from "@/types/domain";

/**
 * 목록 한 줄.
 * 관리자는 눌러서 바로 점검 화면으로 이동할 수 있고,
 * 점검자는 QR 스캔으로만 점검할 수 있으므로 정보 표시만 한다.
 */
function ExtinguisherRow({ row, allowDirect }: { row: ExtinguisherOverview; allowDirect: boolean }) {
  const inner = (
    <>
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
    </>
  );

  const className = "flex items-center justify-between gap-2 border-b px-1 py-3 last:border-0";

  if (!allowDirect) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <Link href={`/inspect/${encodeURIComponent(row.asset_code)}`} className={`hover:bg-accent ${className}`}>
      {inner}
    </Link>
  );
}

function buildingLabelOf(r: ExtinguisherOverview) {
  return `${r.site_name} ${r.building_no}동${r.building_name ? ` (${r.building_name})` : ""}`;
}

/** 건물별로 묶은 목록. 건물 제목 + 대수 아래에 소화기들이 나열된다. */
function BuildingGroupedList({
  list,
  allowDirect,
}: {
  list: ExtinguisherOverview[];
  allowDirect: boolean;
}) {
  const groups = new Map<string, { label: string; items: ExtinguisherOverview[] }>();
  for (const r of list) {
    const key = String(r.building_id);
    const group = groups.get(key) ?? { label: buildingLabelOf(r), items: [] };
    group.items.push(r);
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, "ko"));

  return (
    <div className="flex flex-col gap-4">
      {sorted.map(({ label, items }) => (
        <div key={label}>
          <h2 className="bg-muted rounded px-2 py-1.5 text-sm font-semibold">
            {label} <span className="text-muted-foreground font-normal">({items.length}대)</span>
          </h2>
          {items.map((row) => (
            <ExtinguisherRow key={row.id} row={row} allowDirect={allowDirect} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function InspectorStatusPage() {
  const supabase = await createClient();

  // 관리자만 목록에서 바로 점검(QR 없이)이 가능하다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const allowDirect = profile?.role === "admin";

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">점검 현황</h1>
        <Button nativeButton={false} render={<Link href="/scan" />}>
          <QrCode className="size-4" /> QR 스캔
        </Button>
      </div>

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
                {allowDirect
                  ? "항목을 누르면 바로 점검 화면으로 이동합니다."
                  : "점검은 현장에서 소화기의 QR 코드를 스캔해야 완료할 수 있습니다."}
              </p>
              <BuildingGroupedList list={notInspected} allowDirect={allowDirect} />
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              이번달 점검이 모두 완료되었습니다. 🎉
            </p>
          )}
        </TabsContent>

        <TabsContent value="all">
          {rows.length ? (
            <BuildingGroupedList list={rows} allowDirect={allowDirect} />
          ) : (
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
            <BuildingGroupedList list={lifecycleAlerts} allowDirect={allowDirect} />
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

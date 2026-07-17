import { ChevronRight, QrCode } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBuildingLabel } from "@/lib/utils/location";
import { createClient } from "@/lib/supabase/server";

interface BuildingSummary {
  id: string;
  label: string;
  total: number;
  inspected: number;
  pending: number;
}

export default async function InspectorStatusPage() {
  const supabase = await createClient();

  // RLS가 담당 사업장 데이터만 반환하므로 별도 필터가 필요 없다.
  const { data: extinguishers } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("status", "active");

  const rows = extinguishers ?? [];
  const notInspectedTotal = rows.filter((r) => !r.inspected_this_month).length;
  const lifecycleAlerts = rows.filter((r) =>
    ["due_90", "due_30", "expired"].includes(r.lifecycle_status)
  ).length;

  // 건물별 요약 (차량 소화기도 소속 건물에 포함)
  const byBuilding = new Map<string, BuildingSummary>();
  for (const r of rows) {
    const key = String(r.building_id);
    let entry = byBuilding.get(key);
    if (!entry) {
      entry = { id: key, label: formatBuildingLabel(r), total: 0, inspected: 0, pending: 0 };
      byBuilding.set(key, entry);
    }
    entry.total += 1;
    if (r.inspected_this_month) entry.inspected += 1;
    else entry.pending += 1;
  }
  // 건물 번호를 숫자로 인식해 정렬(10동이 2동보다 앞서는 문제 방지)
  const buildings = [...byBuilding.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "ko", { numeric: true })
  );

  const summaryCards = [
    { label: "총 소화기", value: rows.length },
    { label: "이번달 점검", value: rows.length - notInspectedTotal },
    { label: "이번달 미점검", value: notInspectedTotal, tone: "warning" as const },
    { label: "교체 필요", value: lifecycleAlerts, tone: "destructive" as const },
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

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs">건물을 누르면 소화기별 상세를 볼 수 있습니다.</p>
        {buildings.map((b) => (
          <Link
            key={b.id}
            href={`/status/${b.id}`}
            className="hover:bg-accent flex items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{b.label}</p>
              <p className="text-muted-foreground text-xs">총 {b.total}대</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right text-xs">
                <p className="text-green-600 dark:text-green-400">점검완료 {b.inspected}</p>
                <p
                  className={
                    b.pending > 0
                      ? "font-semibold text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  }
                >
                  미점검 {b.pending}
                </p>
              </div>
              <ChevronRight className="text-muted-foreground size-4" />
            </div>
          </Link>
        ))}
        {buildings.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">등록된 소화기가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

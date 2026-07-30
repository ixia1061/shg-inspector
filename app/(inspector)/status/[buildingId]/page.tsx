import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExtinguisherStatusRow } from "@/components/inspector/ExtinguisherStatusRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { groupByFloor, shortRowLocation } from "@/lib/utils/floorGroup";
import { formatBuildingLabel } from "@/lib/utils/location";
import { isAdminRole } from "@/lib/utils/roles";
import { sortByAssetCode } from "@/lib/utils/sort";
import { createClient } from "@/lib/supabase/server";
import type { ExtinguisherOverview } from "@/types/domain";

function RowList({
  list,
  all,
  floorOrder,
  allowDirect,
  showProgress,
}: {
  list: ExtinguisherOverview[];
  all: ExtinguisherOverview[];
  floorOrder: Map<string, number>;
  allowDirect: boolean;
  /** 미점검 탭에서는 남은 대수보다 "8대 중 5대 완료"가 더 쓸모 있다. */
  showProgress: boolean;
}) {
  if (!list.length) {
    return <p className="text-muted-foreground py-8 text-center text-sm">해당하는 소화기가 없습니다.</p>;
  }

  const groups = groupByFloor(list, all, floorOrder);

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="bg-muted/60 flex items-center justify-between rounded-md px-2 py-1.5">
            <span className="text-sm font-semibold">{group.label}</span>
            <span className="text-muted-foreground text-xs">
              {showProgress ? `${group.total}대 중 ${group.done}대 완료` : `${group.rows.length}대`}
            </span>
          </div>
          {group.rows.map((row) => (
            <ExtinguisherStatusRow
              key={row.id}
              row={row}
              allowDirect={allowDirect}
              locationText={shortRowLocation(row)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

export default async function BuildingStatusPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const { buildingId } = await params;
  const supabase = await createClient();

  // 관리자만 목록에서 바로 점검(QR 없이)이 가능하다.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const allowDirect = isAdminRole(profile?.role);

  const { data: extinguishers } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("status", "active")
    .eq("building_id", buildingId)
    .order("asset_code");

  const rows = sortByAssetCode(extinguishers ?? []);

  // 건물명은 소화기가 없어도 표시할 수 있게 건물 테이블에서 조회 (RLS로 접근 검증 겸용)
  const { data: building } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", buildingId)
    .maybeSingle();
  if (!building) notFound();

  const { data: site } = await supabase
    .from("sites")
    .select("name")
    .eq("id", building.site_id)
    .single();

  // 층 순서는 관리자가 사업장 상세에서 정한 order_index를 따른다(뷰에는 없는 값).
  const { data: floorRows } = await supabase
    .from("floors")
    .select("id, order_index")
    .eq("building_id", buildingId);
  const floorOrder = new Map((floorRows ?? []).map((f) => [f.id, f.order_index]));

  const label = formatBuildingLabel({
    site_name: site?.name ?? "",
    building_no: building.building_no,
    building_name: building.name,
  });

  const pending = rows.filter((r) => !r.inspected_this_month);
  const done = rows.filter((r) => r.inspected_this_month);
  const lifecycleAlerts = rows.filter((r) =>
    ["due_90", "due_30", "expired"].includes(r.lifecycle_status)
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <Link href="/status" className="text-muted-foreground flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> 건물 목록
        </Link>
        <h1 className="mt-1 text-xl font-bold">{label}</h1>
        <p className="text-muted-foreground text-sm">
          총 {rows.length}대 · 점검완료 {done.length} · 미점검 {pending.length}
        </p>
        {!allowDirect && (
          <p className="text-muted-foreground mt-1 text-xs">
            점검은 현장에서 소화기의 QR 코드를 스캔해야 완료할 수 있습니다.
          </p>
        )}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTrigger value="pending">미점검 ({pending.length})</TabsTrigger>
          <TabsTrigger value="done">점검완료 ({done.length})</TabsTrigger>
          <TabsTrigger value="lifecycle">연수 ({lifecycleAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pending.length ? (
            <RowList
              list={pending}
              all={rows}
              floorOrder={floorOrder}
              allowDirect={allowDirect}
              showProgress
            />
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              이 건물의 이번달 점검이 모두 완료되었습니다. 🎉
            </p>
          )}
        </TabsContent>

        <TabsContent value="done">
          <RowList
            list={done}
            all={rows}
            floorOrder={floorOrder}
            allowDirect={allowDirect}
            showProgress={false}
          />
        </TabsContent>

        <TabsContent value="lifecycle">
          {lifecycleAlerts.length ? (
            <RowList
              list={lifecycleAlerts}
              all={rows}
              floorOrder={floorOrder}
              allowDirect={allowDirect}
              showProgress={false}
            />
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

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExtinguisherStatusRow } from "@/components/inspector/ExtinguisherStatusRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBuildingLabel } from "@/lib/utils/location";
import { isAdminRole } from "@/lib/utils/roles";
import { createClient } from "@/lib/supabase/server";
import type { ExtinguisherOverview } from "@/types/domain";

function RowList({ list, allowDirect }: { list: ExtinguisherOverview[]; allowDirect: boolean }) {
  if (!list.length) {
    return <p className="text-muted-foreground py-8 text-center text-sm">해당하는 소화기가 없습니다.</p>;
  }
  return (
    <div>
      {list.map((row) => (
        <ExtinguisherStatusRow key={row.id} row={row} allowDirect={allowDirect} />
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

  const rows = extinguishers ?? [];

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
            <RowList list={pending} allowDirect={allowDirect} />
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              이 건물의 이번달 점검이 모두 완료되었습니다. 🎉
            </p>
          )}
        </TabsContent>

        <TabsContent value="done">
          <RowList list={done} allowDirect={allowDirect} />
        </TabsContent>

        <TabsContent value="lifecycle">
          {lifecycleAlerts.length ? (
            <RowList list={lifecycleAlerts} allowDirect={allowDirect} />
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

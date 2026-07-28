import { Car } from "lucide-react";
import { notFound } from "next/navigation";

import { BuildingFormDialog } from "@/components/admin/BuildingFormDialog";
import { FloorFormDialog } from "@/components/admin/FloorFormDialog";
import { FloorList } from "@/components/admin/FloorList";
import { JoinCodeCard } from "@/components/admin/JoinCodeCard";
import { PartFormDialog } from "@/components/admin/PartFormDialog";
import { SiteFormDialog } from "@/components/admin/SiteFormDialog";
import { VehicleFormDialog } from "@/components/admin/VehicleFormDialog";
import { getCurrentUserRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminRole } from "@/lib/utils/roles";
import type { Floor, Vehicle } from "@/types/domain";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase.from("sites").select("*").eq("id", siteId).single();
  if (!site) notFound();

  // 사업장 수정/삭제는 시스템관리자만. 건물 이하는 일반 관리자도 가능.
  const canManageSite = isSuperAdminRole(await getCurrentUserRole());

  const { data: parts } = await supabase
    .from("management_parts")
    .select("*")
    .eq("site_id", siteId)
    .order("order_index");

  // 점검자 가입코드(사업장당 1개). 담당 관리자도 코드를 보고 점검자에게 알려줄 수 있고,
  // 발급·재발급만 시스템관리자 몫이다. (RLS가 담당 사업장으로 한정)
  const { data: joinCode } = await supabase
    .from("site_join_codes")
    .select("code")
    .eq("site_id", siteId)
    .maybeSingle();

  const { data: buildings } = await supabase
    .from("buildings")
    .select("*")
    .eq("site_id", siteId)
    .order("building_no");

  const buildingIds = (buildings ?? []).map((b) => b.id);

  // order_index가 같은 층(과거 수동 입력)의 순서가 렌더링마다 바뀌지 않도록 created_at을 2차 정렬로 둔다.
  const { data: floors } = buildingIds.length
    ? await supabase
        .from("floors")
        .select("*")
        .in("building_id", buildingIds)
        .order("order_index")
        .order("created_at")
    : { data: [] as Floor[] };

  // 차량은 건물 소속
  const { data: vehicles } = buildingIds.length
    ? await supabase.from("vehicles").select("*").in("building_id", buildingIds).order("vehicle_no")
    : { data: [] as Vehicle[] };

  const floorsByBuilding = groupBy(floors ?? [], "building_id");
  const vehiclesByBuilding = groupBy(vehicles ?? [], "building_id");

  const nextBuildingNo = (buildings ?? []).reduce((max, b) => Math.max(max, b.building_no), 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{site.name}</h1>
          <p className="text-muted-foreground text-sm">{site.address}</p>
        </div>
        <div className="flex gap-2">
          {canManageSite && <SiteFormDialog site={site} />}
          <BuildingFormDialog siteId={site.id} nextBuildingNo={nextBuildingNo} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div>
          <h2 className="text-lg font-semibold">점검자 가입코드</h2>
          <p className="text-muted-foreground text-sm">
            점검자가 가입 신청 화면에서 이 코드를 넣으면 이 사업장으로 접수됩니다. 신청은
            사용자 관리에서 승인합니다.
            {canManageSite ? "" : " (발급·재발급은 시스템관리자만 할 수 있습니다)"}
          </p>
        </div>
        <JoinCodeCard
          siteId={site.id}
          code={joinCode?.code ?? null}
          canIssue={canManageSite}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">관리파트</h2>
            <p className="text-muted-foreground text-sm">
              관리번호 앞자리(예: 소방-1-1-1)를 결정합니다. 소화기 등록 시 파트를 선택합니다.
            </p>
          </div>
          {canManageSite && (
            <PartFormDialog siteId={site.id} nextOrderIndex={(parts ?? []).length} />
          )}
        </div>
        {(parts ?? []).length ? (
          <ul className="flex flex-wrap gap-2">
            {(parts ?? []).map((part) => (
              <li
                key={part.id}
                className="bg-muted flex items-center gap-1 rounded px-3 py-2 text-sm"
              >
                <span className="font-medium">{part.name}</span>
                <span className="text-muted-foreground font-mono text-xs">({part.code})</span>
                {canManageSite && <PartFormDialog siteId={site.id} part={part} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            등록된 관리파트가 없습니다. {canManageSite ? "'관리파트 추가'로 만들어주세요." : ""}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">건물</h2>
        {(buildings ?? []).map((building) => {
          const buildingVehicles = vehiclesByBuilding[building.id] ?? [];
          const nextVehicleNo =
            buildingVehicles.reduce((max, v) => Math.max(max, v.vehicle_no), 0) + 1;

          return (
            <div key={building.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <h3 className="font-semibold">
                    {building.building_no}동{building.name ? ` (${building.name})` : ""}
                  </h3>
                  <BuildingFormDialog siteId={site.id} building={building} />
                </div>
                <div className="flex items-center gap-1">
                  <VehicleFormDialog buildingId={building.id} nextVehicleNo={nextVehicleNo} />
                  <FloorFormDialog
                    buildingId={building.id}
                    nextOrderIndex={(floorsByBuilding[building.id] ?? []).length}
                  />
                </div>
              </div>

              {/* key: 층 추가/삭제/외부 갱신 시 리마운트되어 로컬 순서 상태를 서버 상태와 다시 맞춘다 */}
              <FloorList
                key={(floorsByBuilding[building.id] ?? []).map((f) => f.id).join("|")}
                buildingId={building.id}
                floors={floorsByBuilding[building.id] ?? []}
              />

              {buildingVehicles.length > 0 && (
                <div className="mt-3 border-t pt-3 pl-4">
                  <ul className="flex flex-wrap gap-2">
                    {buildingVehicles.map((vehicle) => (
                      <li
                        key={vehicle.id}
                        className="bg-muted flex items-center gap-1 rounded px-3 py-2 text-sm"
                      >
                        <Car className="text-muted-foreground size-3.5" />
                        차량 {vehicle.vehicle_no}호
                        {vehicle.plate_no ? ` [${vehicle.plate_no}]` : ""}
                        {vehicle.name ? ` (${vehicle.name})` : ""}
                        {vehicle.department ? (
                          <span className="bg-background text-muted-foreground rounded px-1 text-xs">
                            {vehicle.department}
                          </span>
                        ) : null}
                        <VehicleFormDialog buildingId={building.id} vehicle={vehicle} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
        {(buildings ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">등록된 건물이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function groupBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = String(item[key]);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

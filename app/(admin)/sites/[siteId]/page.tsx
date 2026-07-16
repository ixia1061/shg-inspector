import { notFound } from "next/navigation";

import { BuildingFormDialog } from "@/components/admin/BuildingFormDialog";
import { FloorFormDialog } from "@/components/admin/FloorFormDialog";
import { FloorList } from "@/components/admin/FloorList";
import { SiteFormDialog } from "@/components/admin/SiteFormDialog";
import { VehicleFormDialog } from "@/components/admin/VehicleFormDialog";
import { createClient } from "@/lib/supabase/server";
import type { Floor, Zone } from "@/types/domain";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase.from("sites").select("*").eq("id", siteId).single();
  if (!site) notFound();

  const { data: buildings } = await supabase
    .from("buildings")
    .select("*")
    .eq("site_id", siteId)
    .order("building_no");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .eq("site_id", siteId)
    .order("vehicle_no");

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

  const floorIds = (floors ?? []).map((f) => f.id);

  const { data: zones } = floorIds.length
    ? await supabase.from("zones").select("*").in("floor_id", floorIds).order("name")
    : { data: [] as Zone[] };

  const floorsByBuilding = groupBy(floors ?? [], "building_id");
  const zonesByFloor = groupBy(zones ?? [], "floor_id");

  const nextBuildingNo = (buildings ?? []).reduce((max, b) => Math.max(max, b.building_no), 0) + 1;
  const nextVehicleNo = (vehicles ?? []).reduce((max, v) => Math.max(max, v.vehicle_no), 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {site.name} <span className="text-muted-foreground text-base font-normal">({site.org_code})</span>
          </h1>
          <p className="text-muted-foreground text-sm">{site.address}</p>
        </div>
        <div className="flex gap-2">
          <SiteFormDialog site={site} />
          <BuildingFormDialog siteId={site.id} nextBuildingNo={nextBuildingNo} />
          <VehicleFormDialog siteId={site.id} nextVehicleNo={nextVehicleNo} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">건물</h2>
        {(buildings ?? []).map((building) => (
          <div key={building.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h3 className="font-semibold">
                  {building.building_no}동{building.name ? ` (${building.name})` : ""}
                </h3>
                <BuildingFormDialog siteId={site.id} building={building} />
              </div>
              <FloorFormDialog
                buildingId={building.id}
                nextOrderIndex={(floorsByBuilding[building.id] ?? []).length}
              />
            </div>
            {/* key: 층 추가/삭제/외부 갱신 시 리마운트되어 로컬 순서 상태를 서버 상태와 다시 맞춘다 */}
            <FloorList
              key={(floorsByBuilding[building.id] ?? []).map((f) => f.id).join("|")}
              buildingId={building.id}
              floors={floorsByBuilding[building.id] ?? []}
              zonesByFloor={zonesByFloor}
            />
          </div>
        ))}
        {(buildings ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">등록된 건물이 없습니다.</p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">차량</h2>
        {(vehicles ?? []).length ? (
          <ul className="flex flex-wrap gap-2">
            {(vehicles ?? []).map((vehicle) => (
              <li key={vehicle.id} className="bg-muted flex items-center gap-1 rounded px-3 py-2 text-sm">
                차량 {vehicle.vehicle_no}호{vehicle.name ? ` (${vehicle.name})` : ""}
                <VehicleFormDialog siteId={site.id} vehicle={vehicle} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">등록된 차량이 없습니다.</p>
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

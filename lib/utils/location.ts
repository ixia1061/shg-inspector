import type { ExtinguisherOverview } from "@/types/domain";

type LocationFields = Pick<
  ExtinguisherOverview,
  | "location_type"
  | "site_name"
  | "building_name"
  | "building_no"
  | "floor_name"
  | "zone_name"
  | "vehicle_name"
  | "vehicle_no"
>;

/** 건물/차량 위치 유형에 따라 사람이 읽는 위치 경로 문자열을 만든다. */
export function formatLocationPath(row: LocationFields): string {
  if (row.location_type === "VEHICLE") {
    const vehicleLabel = row.vehicle_name
      ? `차량 ${row.vehicle_no}호 (${row.vehicle_name})`
      : `차량 ${row.vehicle_no}호`;
    return [row.site_name, vehicleLabel].filter(Boolean).join(" > ");
  }

  const buildingLabel = row.building_name
    ? `${row.building_no}동 (${row.building_name})`
    : `${row.building_no}동`;

  return [row.site_name, buildingLabel, row.floor_name, row.zone_name].filter(Boolean).join(" > ");
}

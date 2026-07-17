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
  | "vehicle_plate_no"
  | "install_note"
>;

function buildingLabelOf(row: Pick<LocationFields, "building_no" | "building_name">): string | null {
  return row.building_no != null
    ? row.building_name
      ? `${row.building_no}동 (${row.building_name})`
      : `${row.building_no}동`
    : null;
}

/** 건물/차량 위치 유형에 따라 사람이 읽는 위치 경로 문자열을 만든다. 차량도 건물 소속이다. */
export function formatLocationPath(row: LocationFields): string {
  const buildingLabel =
    row.building_no != null
      ? row.building_name
        ? `${row.building_no}동 (${row.building_name})`
        : `${row.building_no}동`
      : null;

  if (row.location_type === "VEHICLE") {
    const plate = row.vehicle_plate_no ? ` [${row.vehicle_plate_no}]` : "";
    const name = row.vehicle_name ? ` (${row.vehicle_name})` : "";
    const vehicleLabel = `차량 ${row.vehicle_no}호${plate}${name}`;
    return [row.site_name, buildingLabel, vehicleLabel].filter(Boolean).join(" > ");
  }

  return [row.site_name, buildingLabel, row.floor_name, row.zone_name].filter(Boolean).join(" > ");
}

/**
 * 소화기 관리 화면용 짧은 위치 표기: 사업장명 없이 "건물명 > 층 > 설치위치".
 * (담당 사업장으로 스코핑된 관리자에게는 사업장명이 중복이라 생략한다.)
 * 차량은 "건물명 > 차량 N호 > 설치위치".
 */
export function formatShortLocation(row: LocationFields): string {
  const buildingLabel = buildingLabelOf(row);

  if (row.location_type === "VEHICLE") {
    const plate = row.vehicle_plate_no ? ` [${row.vehicle_plate_no}]` : "";
    const name = row.vehicle_name ? ` (${row.vehicle_name})` : "";
    const vehicleLabel = `차량 ${row.vehicle_no}호${plate}${name}`;
    return [buildingLabel, vehicleLabel, row.install_note].filter(Boolean).join(" > ");
  }

  return [buildingLabel, row.floor_name, row.install_note].filter(Boolean).join(" > ");
}

/** "사업장 N동 (건물명)" 형식의 건물 라벨 */
export function formatBuildingLabel(row: {
  site_name: string;
  building_no: number | null;
  building_name: string | null;
}): string {
  return `${row.site_name} ${row.building_no}동${row.building_name ? ` (${row.building_name})` : ""}`;
}

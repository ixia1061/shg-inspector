import type { ExtinguisherOverview } from "@/types/domain";

/**
 * 점검자 건물 현황을 층 단위로 묶는다.
 * 현장에서는 층을 옮겨가며 도는데 목록이 관리번호 순 평면이면 어디까지 했는지 알기 어렵다.
 */
export interface FloorGroup {
  key: string;
  label: string;
  order: number;
  rows: ExtinguisherOverview[];
  /** 그 층 전체 대수와 이번달 점검 완료 수 — 탭과 무관하게 진행 상황을 보여준다. */
  total: number;
  done: number;
}

export const VEHICLE_GROUP_KEY = "vehicle";

function groupKeyOf(row: ExtinguisherOverview): string {
  return row.location_type === "VEHICLE" ? VEHICLE_GROUP_KEY : (row.floor_id ?? "unknown");
}

/**
 * @param list       화면에 보여줄 행(탭으로 걸러진 것)
 * @param all        건물 전체 행 — 층별 진행률(8대 중 5대)을 내는 데 쓴다
 * @param floorOrder 층 정렬 순서(관리자가 사업장 상세에서 정한 order_index)
 */
export function groupByFloor(
  list: ExtinguisherOverview[],
  all: ExtinguisherOverview[],
  floorOrder: Map<string, number>
): FloorGroup[] {
  const totals = new Map<string, { total: number; done: number }>();
  for (const row of all) {
    const key = groupKeyOf(row);
    const entry = totals.get(key) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (row.inspected_this_month) entry.done += 1;
    totals.set(key, entry);
  }

  const groups = new Map<string, FloorGroup>();
  for (const row of list) {
    const key = groupKeyOf(row);
    let group = groups.get(key);
    if (!group) {
      const isVehicle = key === VEHICLE_GROUP_KEY;
      group = {
        key,
        label: isVehicle ? "차량" : (row.floor_name ?? "층 미지정"),
        // 차량은 층 다음에 오도록 맨 뒤로 보낸다.
        order: isVehicle ? Number.MAX_SAFE_INTEGER : (floorOrder.get(key) ?? 0),
        rows: [],
        total: totals.get(key)?.total ?? 0,
        done: totals.get(key)?.done ?? 0,
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  return [...groups.values()].sort(
    (a, b) => a.order - b.order || a.label.localeCompare(b.label, "ko")
  );
}

/** 층 헤더에 이미 위치가 있으므로 행에는 설치위치(차량은 번호판·부서)만 남긴다. */
export function shortRowLocation(row: ExtinguisherOverview): string {
  if (row.location_type === "VEHICLE") {
    const vehicle = row.vehicle_plate_no
      ? row.vehicle_name
        ? `${row.vehicle_plate_no} (${row.vehicle_name})`
        : row.vehicle_plate_no
      : (row.vehicle_name ?? `차량 ${row.vehicle_no}호`);
    return [vehicle, row.vehicle_department].filter(Boolean).join(" > ");
  }
  return row.install_note ?? "";
}

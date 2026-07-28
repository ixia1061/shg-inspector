import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { defectItemsText, isActionNeeded, LEDGER_CHECK_ITEMS } from "@/lib/utils/inspection";
import { LIFECYCLE_STATUS_LABEL } from "@/lib/utils/lifecycle";
import { formatShortLocation } from "@/lib/utils/location";
import { isAdminRole } from "@/lib/utils/roles";
import { sortByAssetCode } from "@/lib/utils/sort";
import type { ExtinguisherOverview, Inspection, LifecycleStatus } from "@/types/domain";

const THIN_BORDER = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

/** "분말소화기" → "분말"처럼 종류 표에서 쓸 짧은 이름(끝의 '소화기' 제거) */
function shortTypeName(name: string): string {
  return name.replace(/\s*소화기$/, "");
}

/** 엑셀 시트명으로 쓸 수 없는 문자 제거 + 31자 제한 */
function safeSheetName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim();
  return (cleaned || fallback).slice(0, 31);
}

/** "1동 (여객터미널)" 형식 건물 라벨 */
function buildingLabelOf(row: ExtinguisherOverview): string {
  if (row.building_no == null) return row.building_name ?? "";
  return row.building_name ? `${row.building_no}동 (${row.building_name})` : `${row.building_no}동`;
}

const resultLabel = (r: string | null): string =>
  r === "normal" ? "정상" : r === "abnormal" ? "이상" : "미점검";

/** 종류+용량 조합 컬럼 정의 */
type Combo = { key: string; type: string; capacity: string; header: string };

/** 최근 점검의 비고 = 불량 내용. 없으면 빈 문자열. */
function defectNote(e: ExtinguisherOverview): string {
  return e.last_inspection_memo ?? "";
}

/** 조치완료 시 입력된 조치 내용. 없으면 빈 문자열. */
function resolvedActionNote(e: ExtinguisherOverview): string {
  return e.last_action_note ?? "";
}

/** 이번달 점검 상태: 미점검 / 조치필요 / 완료 */
function monthStatus(e: ExtinguisherOverview): string {
  if (!e.inspected_this_month) return "미점검";
  if (isActionNeeded(e)) return "조치필요";
  return "완료";
}

/**
 * 점검사항 한 항목의 표기: 체크 유지=O, 체크 해제=X, 값 없음(미점검·구버전 점검)=빈칸.
 * 관리자가 조치를 완료한 소화기는 불량이 해소된 상태이므로 X도 O로 표기한다.
 * (무엇이 불량이었는지는 불량항목·불량내용·조치내용 컬럼에 그대로 남는다.)
 */
const checkMark = (ok: boolean | null, resolved: boolean): string =>
  ok === null ? "" : ok || resolved ? "O" : "X";

/** timestamptz(UTC ISO)를 KST 기준 'YYYY-MM-DD'로. (UTC로 자르면 최대 9시간 하루 오차) */
function kstDate(iso: string | null): string {
  if (!iso) return "";
  // en-CA 로케일은 YYYY-MM-DD 형식
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** 오늘(KST) 기준 'YYYY-MM' */
function currentKstMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 7);
}

/** 'YYYY-MM'의 시작/다음달 시작을 KST 기준 UTC ISO로. 점검 조회 범위에 쓴다. */
function kstMonthRange(month: string): { fromIso: string; toIso: string } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(`${month}-01T00:00:00+09:00`);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const to = new Date(`${nextMonth}-01T00:00:00+09:00`);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/** 'YYYY-MM' → '2026년 7월' */
function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}

/**
 * 관리자 전용: 지정 사업장(site 쿼리)의 소화기 관리대장을 Excel(.xlsx)로 내려준다.
 * - 표지 시트: 점검일자·점검자 수기 기입란 + 동·층별 종류/수량 보유현황표
 * - 점검대장 시트: 소화기 1대당 1행 (위치는 사업장명 제외)
 * RLS로 담당 사업장만 조회되므로 접근 불가 사업장은 빈 결과가 된다.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const siteId = params.get("site");
  if (!siteId) {
    return NextResponse.json({ error: "사업장을 지정해야 합니다" }, { status: 400 });
  }

  // month=YYYY-MM이면 그 달 기준 대장. 없거나 이번달이면 지금까지처럼 "현재 상태" 대장.
  const monthParam = params.get("month");
  if (monthParam && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    return NextResponse.json({ error: "월 형식이 올바르지 않습니다 (YYYY-MM)" }, { status: 400 });
  }
  const thisMonth = currentKstMonth();
  const month = monthParam ?? thisMonth;
  const isPastMonth = month < thisMonth;

  const { data: rowsRaw } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("status", "active")
    .eq("site_id", siteId);

  let all = sortByAssetCode(rowsRaw ?? []) as ExtinguisherOverview[];
  if (all.length === 0) {
    return NextResponse.json({ error: "해당 사업장에 소화기가 없거나 접근 권한이 없습니다" }, { status: 404 });
  }
  const siteName = all[0].site_name ?? "사업장";

  // 지난달 대장: 뷰의 "가장 최근 점검"을 그 달 안의 마지막 점검으로 바꿔 끼운다.
  // (뷰는 월 조건 없이 최신 1건만 들고 있어, 그대로 쓰면 그 이후 점검이 섞인다)
  if (isPastMonth) {
    all = await applyMonthSnapshot(supabase, all, month);
  }

  // 최근 점검자 이름 매핑
  const inspectorIds = [...new Set(all.map((r) => r.last_inspector_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (inspectorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", inspectorIds);
    for (const p of profiles ?? []) nameById.set(p.id, p.name ?? "");
  }

  // 종류+용량 조합 목록(분말 우선, 종류 가나다순, 용량 오름차순)
  const comboMap = new Map<string, Combo>();
  for (const r of all) {
    if (!r.extinguisher_type_name) continue;
    const type = r.extinguisher_type_name;
    const capacity = r.capacity ?? "";
    const key = `${type}|${capacity}`;
    if (!comboMap.has(key)) {
      const header = `${shortTypeName(type)}${capacity ? ` ${capacity}` : ""}`;
      comboMap.set(key, { key, type, capacity, header });
    }
  }
  const combos = [...comboMap.values()].sort((a, b) => {
    const pa = a.type.startsWith("분말") ? 0 : 1;
    const pb = b.type.startsWith("분말") ? 0 : 1;
    return (
      pa - pb ||
      a.type.localeCompare(b.type, "ko") ||
      (parseFloat(a.capacity) || 0) - (parseFloat(b.capacity) || 0) ||
      a.capacity.localeCompare(b.capacity, "ko")
    );
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "소화기 점검 관리 시스템";
  workbook.created = new Date();

  buildCoverSheet(workbook, siteName, all, combos, isPastMonth ? month : null);
  buildLedgerSheet(
    workbook,
    safeSheetName(`${siteName} 점검대장`, "점검대장"),
    all,
    nameById,
    isPastMonth ? month : null,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  // 지난달 대장은 파일명에 그 달을 박아 여러 달치를 모아둬도 구분되게 한다.
  const filename = isPastMonth
    ? `소화기관리대장_${siteName}_${month}.xlsx`
    : `소화기관리대장_${siteName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ledger.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

/**
 * 지정한 달 기준으로 각 소화기의 "그 달 마지막 점검"을 뷰 행에 덮어쓴다.
 *
 * v_extinguisher_overview는 월과 무관하게 최신 점검 1건만 들고 있어서, 지난달 대장을
 * 그대로 뽑으면 그 뒤에 한 점검이 섞여 나온다. 그래서 그 달 점검을 직접 조회해
 * last_* 계열과 inspected_this_month(= 그 달에 점검했는가)를 바꿔 끼운다.
 * 그 달에 점검이 없던 소화기는 "미점검"이 되도록 값을 전부 비운다.
 */
async function applyMonthSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ExtinguisherOverview[],
  month: string,
): Promise<ExtinguisherOverview[]> {
  const { fromIso, toIso } = kstMonthRange(month);
  const ids = rows.map((r) => r.id);

  const { data: inspections } = await supabase
    .from("inspections")
    .select("*")
    .in("extinguisher_id", ids)
    .gte("inspected_at", fromIso)
    .lt("inspected_at", toIso)
    .order("inspected_at", { ascending: true });

  // 오름차순이라 나중 것이 앞의 것을 덮어써 "그 달 마지막 점검"이 남는다.
  const lastByExtinguisher = new Map<string, Inspection>();
  for (const i of inspections ?? []) lastByExtinguisher.set(i.extinguisher_id, i);

  // 그 점검들에 달린 조치 기록(조치내용·조치일)
  const inspectionIds = [...lastByExtinguisher.values()].map((i) => i.id);
  const actionByInspection = new Map<string, { action_note: string; resolved_at: string }>();
  if (inspectionIds.length) {
    const { data: actions } = await supabase
      .from("inspection_actions")
      .select("inspection_id, action_note, resolved_at")
      .in("inspection_id", inspectionIds);
    for (const a of actions ?? []) {
      actionByInspection.set(a.inspection_id, {
        action_note: a.action_note,
        resolved_at: a.resolved_at,
      });
    }
  }

  return rows.map((row) => {
    const insp = lastByExtinguisher.get(row.id);
    if (!insp) {
      // 그 달에 점검 없음 → 미점검 행
      return {
        ...row,
        inspected_this_month: false,
        last_inspected_at: null,
        last_inspection_result: null,
        last_inspector_id: null,
        last_inspection_memo: null,
        last_action_note: null,
        last_action_resolved_at: null,
        last_agent_discharge_ok: null,
        last_agent_caking_ok: null,
        last_gauge_ok: null,
        last_handle_ok: null,
        last_hose_ok: null,
        last_hose_holder_ok: null,
        last_etc_ok: null,
        last_pressure_ok: null,
        last_seal_ok: null,
        last_appearance_ok: null,
        last_installation_ok: null,
      };
    }
    const action = actionByInspection.get(insp.id);
    return {
      ...row,
      inspected_this_month: true,
      last_inspected_at: insp.inspected_at,
      last_inspection_result: insp.overall_result,
      last_inspector_id: insp.inspector_id,
      last_inspection_memo: insp.memo,
      last_action_note: action?.action_note ?? null,
      last_action_resolved_at: action?.resolved_at ?? null,
      last_agent_discharge_ok: insp.agent_discharge_ok,
      last_agent_caking_ok: insp.agent_caking_ok,
      last_gauge_ok: insp.gauge_ok,
      last_handle_ok: insp.handle_ok,
      last_hose_ok: insp.hose_ok,
      last_hose_holder_ok: insp.hose_holder_ok,
      last_etc_ok: insp.etc_ok,
      last_pressure_ok: insp.pressure_ok,
      last_seal_ok: insp.seal_ok,
      last_appearance_ok: insp.appearance_ok,
      last_installation_ok: insp.installation_ok,
    };
  });
}

/** 표지: 제목 + 점검일자/점검자 수기란 + 동·층별 종류·용량/수량 보유현황표 */
function buildCoverSheet(
  workbook: ExcelJS.Workbook,
  siteName: string,
  all: ExtinguisherOverview[],
  combos: Combo[],
  /** 지난달 대장이면 'YYYY-MM', 현재 상태 대장이면 null */
  month: string | null,
) {
  const sheet = workbook.addWorksheet("표지");
  const colCount = 2 + combos.length + 1; // 건물 + 층 + 종류·용량들 + 합계

  // 열 폭
  sheet.getColumn(1).width = 22; // 건물
  sheet.getColumn(2).width = 14; // 층
  for (let c = 3; c <= 2 + combos.length; c++) sheet.getColumn(c).width = 11;
  sheet.getColumn(colCount).width = 10; // 합계

  // 제목
  sheet.mergeCells(1, 1, 1, colCount);
  const title = sheet.getCell(1, 1);
  title.value = month
    ? `소화기 점검 관리대장 (${siteName}) — ${monthLabel(month)}`
    : `소화기 점검 관리대장 (${siteName})`;
  title.font = { bold: true, size: 18 };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 32;

  // 점검일자 / 점검자 수기란
  for (const [i, label] of ["점검일자", "점검자"].entries()) {
    const rowIdx = 3 + i;
    const labelCell = sheet.getCell(rowIdx, 1);
    labelCell.value = label;
    labelCell.font = { bold: true };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.border = THIN_BORDER;
    sheet.mergeCells(rowIdx, 2, rowIdx, colCount);
    sheet.getCell(rowIdx, 2).border = THIN_BORDER;
    sheet.getRow(rowIdx).height = 24;
  }

  // 보유현황 제목
  const bohaTitle = sheet.getCell(6, 1);
  bohaTitle.value = "■ 동·층별 보유현황 (종류·용량)";
  bohaTitle.font = { bold: true, size: 13 };

  // 2단 헤더: 상위행=소화기 종류, 하위행=용량 (기존 대장 형식)
  const headerRowIdx = 7; // 상위행(종류)
  const subRowIdx = 8; // 하위행(용량)

  // 종류별 컬럼 범위(연속 combos를 종류 단위로 묶음)
  const typeGroups: { type: string; start: number; end: number }[] = [];
  combos.forEach((combo, i) => {
    const dataCol = 3 + i;
    const last = typeGroups[typeGroups.length - 1];
    if (last && last.type === combo.type) last.end = dataCol;
    else typeGroups.push({ type: combo.type, start: dataCol, end: dataCol });
  });

  const styleHeader = (cell: ExcelJS.Cell, value: string) => {
    cell.value = value;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = THIN_BORDER;
  };

  // 건물/층/합계: 두 행 세로 병합
  sheet.mergeCells(headerRowIdx, 1, subRowIdx, 1);
  styleHeader(sheet.getCell(headerRowIdx, 1), "건물");
  sheet.mergeCells(headerRowIdx, 2, subRowIdx, 2);
  styleHeader(sheet.getCell(headerRowIdx, 2), "층");
  sheet.mergeCells(headerRowIdx, colCount, subRowIdx, colCount);
  styleHeader(sheet.getCell(headerRowIdx, colCount), "합계");

  // 종류(상위): 용량 컬럼들 위에 가로 병합
  for (const tg of typeGroups) {
    if (tg.end > tg.start) sheet.mergeCells(headerRowIdx, tg.start, headerRowIdx, tg.end);
    styleHeader(sheet.getCell(headerRowIdx, tg.start), shortTypeName(tg.type));
  }
  // 용량(하위)
  combos.forEach((combo, i) => {
    styleHeader(sheet.getCell(subRowIdx, 3 + i), combo.capacity || "-");
  });

  // (건물, 층) 그룹별 종류 카운트 집계
  type Group = {
    buildingLabel: string;
    buildingNo: number;
    floorLabel: string;
    floorSort: string;
    counts: Map<string, number>;
    total: number;
  };
  const groups = new Map<string, Group>();
  for (const r of all) {
    if (!r.extinguisher_type_name) continue;
    const isVehicle = r.location_type === "VEHICLE";
    const floorLabel = isVehicle ? "차량" : (r.floor_name ?? r.floor_code ?? "-");
    const floorSort = isVehicle ? "￿" : (r.floor_code ?? r.floor_name ?? "");
    const key = `${r.building_no ?? 0} ${floorSort} ${floorLabel}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        buildingLabel: buildingLabelOf(r),
        buildingNo: r.building_no ?? 0,
        floorLabel,
        floorSort,
        counts: new Map(),
        total: 0,
      };
      groups.set(key, g);
    }
    const comboKey = `${r.extinguisher_type_name}|${r.capacity ?? ""}`;
    g.counts.set(comboKey, (g.counts.get(comboKey) ?? 0) + 1);
    g.total += 1;
  }

  const sorted = [...groups.values()].sort(
    (a, b) => a.buildingNo - b.buildingNo || a.floorSort.localeCompare(b.floorSort, undefined, { numeric: true }),
  );

  // 종류별 총계 누적
  const colTotal = new Map<string, number>();
  let grandTotal = 0;

  let rowIdx = subRowIdx + 1;
  let buildingStart = rowIdx;
  let prevBuilding: string | null = null;
  const mergeRanges: [number, number][] = [];

  for (const g of sorted) {
    // 건물이 바뀌면 이전 건물 병합 범위 기록
    if (prevBuilding !== null && g.buildingLabel !== prevBuilding) {
      if (rowIdx - 1 > buildingStart) mergeRanges.push([buildingStart, rowIdx - 1]);
      buildingStart = rowIdx;
    }
    prevBuilding = g.buildingLabel;

    sheet.getCell(rowIdx, 1).value = g.buildingLabel;
    sheet.getCell(rowIdx, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(rowIdx, 1).border = THIN_BORDER;
    sheet.getCell(rowIdx, 2).value = g.floorLabel;
    sheet.getCell(rowIdx, 2).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(rowIdx, 2).border = THIN_BORDER;

    combos.forEach((combo, i) => {
      const c = g.counts.get(combo.key) ?? 0;
      const cell = sheet.getCell(rowIdx, 3 + i);
      cell.value = c === 0 ? "" : c;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = THIN_BORDER;
      colTotal.set(combo.key, (colTotal.get(combo.key) ?? 0) + c);
    });
    const totalCell = sheet.getCell(rowIdx, colCount);
    totalCell.value = g.total;
    totalCell.alignment = { horizontal: "center", vertical: "middle" };
    totalCell.border = THIN_BORDER;
    grandTotal += g.total;

    rowIdx += 1;
  }
  // 마지막 건물 병합 범위
  if (prevBuilding !== null && rowIdx - 1 > buildingStart) mergeRanges.push([buildingStart, rowIdx - 1]);
  // 같은 건물 여러 층이면 건물 셀 세로 병합
  for (const [s, e] of mergeRanges) sheet.mergeCells(s, 1, e, 1);

  // 총계 행
  sheet.mergeCells(rowIdx, 1, rowIdx, 2);
  const totalLabel = sheet.getCell(rowIdx, 1);
  totalLabel.value = "총계";
  totalLabel.font = { bold: true };
  totalLabel.alignment = { horizontal: "center", vertical: "middle" };
  totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
  totalLabel.border = THIN_BORDER;
  sheet.getCell(rowIdx, 2).border = THIN_BORDER;
  combos.forEach((combo, i) => {
    const cell = sheet.getCell(rowIdx, 3 + i);
    cell.value = colTotal.get(combo.key) ?? 0;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
    cell.border = THIN_BORDER;
  });
  const grandCell = sheet.getCell(rowIdx, colCount);
  grandCell.value = grandTotal;
  grandCell.font = { bold: true };
  grandCell.alignment = { horizontal: "center", vertical: "middle" };
  grandCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
  grandCell.border = THIN_BORDER;
}

/** 점검대장: 소화기 1대당 1행 (위치는 사업장명 제외, 위치 컬럼 넓게) */
function buildLedgerSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: ExtinguisherOverview[],
  nameById: Map<string, string>,
  /** 지난달 대장이면 'YYYY-MM' — 상태 컬럼 이름을 그 달로 바꾼다 */
  month: string | null,
) {
  const sheet = workbook.addWorksheet(sheetName);
  // 점검사항 6개(약제방출~호스걸이)는 내용연수상태와 최근점검일 사이에 들어간다.
  sheet.columns = [
    { header: "관리번호", key: "asset_code", width: 18 },
    { header: "위치", key: "location", width: 58 },
    { header: "종류", key: "type", width: 14 },
    { header: "용량", key: "capacity", width: 10 },
    { header: "제조일", key: "manufacture_date", width: 12 },
    { header: "제조번호", key: "serial_no", width: 14 },
    { header: "내용연수(년)", key: "useful_life", width: 12 },
    { header: "교체예정일", key: "replace_due", width: 12 },
    { header: "내용연수상태", key: "lifecycle", width: 14 },
    ...LEDGER_CHECK_ITEMS.map((item) => ({ header: item.header, key: item.key, width: 9 })),
    { header: "최근점검일", key: "last_inspected", width: 12 },
    { header: "점검결과", key: "result", width: 10 },
    { header: "불량항목", key: "defect", width: 18 },
    { header: "불량내용", key: "defect_note", width: 24 },
    { header: "조치내용", key: "action", width: 28 },
    { header: "점검자", key: "inspector", width: 12 },
    { header: month ? `${monthLabel(month)} 상태` : "이번달상태", key: "month", width: 13 },
  ];

  /** key로 컬럼 번호를 찾는다(점검사항 추가로 인덱스가 밀리므로 하드코딩하지 않는다). */
  const colNo = (key: string) => sheet.getColumn(key).number;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = THIN_BORDER;
  });

  for (const e of rows) {
    // 조치완료된 소화기는 점검사항을 O로 되돌린다(조치로 불량이 해소된 상태).
    const resolved = !!e.last_action_resolved_at;
    const row = sheet.addRow({
      asset_code: e.asset_code,
      location: formatShortLocation(e),
      type: e.extinguisher_type_name ?? "",
      capacity: e.capacity ?? "",
      manufacture_date: e.manufacture_date ?? "",
      serial_no: e.serial_no ?? "",
      useful_life: e.useful_life_years ?? "",
      replace_due: e.replace_due_date ?? "",
      lifecycle: LIFECYCLE_STATUS_LABEL[e.lifecycle_status as LifecycleStatus] ?? "",
      ...Object.fromEntries(
        LEDGER_CHECK_ITEMS.map((item) => [item.key, checkMark(e[item.viewKey], resolved)]),
      ),
      last_inspected: kstDate(e.last_inspected_at),
      result: resultLabel(e.last_inspection_result),
      defect: defectItemsText(e),
      defect_note: defectNote(e),
      action: resolvedActionNote(e),
      inspector: e.last_inspector_id ? (nameById.get(e.last_inspector_id) ?? "") : "",
      month: monthStatus(e),
    });
    // 위치·불량항목·불량내용·조치내용 셀은 왼쪽 정렬로 전체가 보이게
    row.getCell(colNo("location")).alignment = { vertical: "middle", horizontal: "left" };
    for (const key of ["defect", "defect_note", "action"]) {
      row.getCell(colNo(key)).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    }
    // 점검사항 O/X는 가운데 정렬
    for (const item of LEDGER_CHECK_ITEMS) {
      row.getCell(colNo(item.key)).alignment = { vertical: "middle", horizontal: "center" };
    }
  }

  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.border = THIN_BORDER;
    });
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

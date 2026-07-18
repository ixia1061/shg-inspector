import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { LIFECYCLE_STATUS_LABEL } from "@/lib/utils/lifecycle";
import { formatShortLocation } from "@/lib/utils/location";
import { isAdminRole } from "@/lib/utils/roles";
import { sortByAssetCode } from "@/lib/utils/sort";
import type { ExtinguisherOverview, LifecycleStatus } from "@/types/domain";

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

const resultLabel = (r: string | null): string =>
  r === "normal" ? "정상" : r === "abnormal" ? "이상" : "미점검";

/**
 * 관리자 전용: 소화기 관리대장을 Excel(.xlsx)로 내려준다.
 * - 표지 시트: 점검일자·점검자 수기 기입란 + 사업장×종류 보유현황표
 * - 사업장별 시트: 소화기 1대당 1행 점검대장(위치는 사업장명 제외)
 * RLS로 담당 사업장만 조회되므로 일반 관리자는 배정 범위만 받는다.
 */
export async function GET() {
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

  const { data: rowsRaw } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("status", "active");

  const all = sortByAssetCode(rowsRaw ?? []) as ExtinguisherOverview[];

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

  // 사업장 목록(데이터 기준, 이름순) — 시트 순서/보유현황 행 순서에 사용
  const siteMap = new Map<string, string>();
  for (const r of all) if (r.site_id) siteMap.set(r.site_id, r.site_name ?? "");
  const sites = [...siteMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  // 종류 목록(분말 우선, 나머지 가나다순)
  const typeSet = new Set<string>();
  for (const r of all) if (r.extinguisher_type_name) typeSet.add(r.extinguisher_type_name);
  const typeNames = [...typeSet].sort((a, b) => {
    const pa = a.startsWith("분말") ? 0 : 1;
    const pb = b.startsWith("분말") ? 0 : 1;
    return pa - pb || a.localeCompare(b, "ko");
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "소화기 점검 관리 시스템";
  workbook.created = new Date();

  // ── 1) 표지 시트 ─────────────────────────────────────────
  buildCoverSheet(workbook, all, sites, typeNames);

  // ── 2) 사업장별 점검대장 시트 ─────────────────────────────
  const usedSheetNames = new Set<string>(["표지"]);
  sites.forEach((site, idx) => {
    const siteRows = all.filter((r) => r.site_id === site.id);
    let name = safeSheetName(site.name, `사업장${idx + 1}`);
    let n = 1;
    while (usedSheetNames.has(name)) {
      n += 1;
      name = safeSheetName(`${site.name}(${n})`, `사업장${idx + 1}-${n}`);
    }
    usedSheetNames.add(name);
    buildLedgerSheet(workbook, name, siteRows, nameById);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `소화기관리대장_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ledger.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

/** 표지: 제목 + 점검일자/점검자 수기란 + 사업장×종류 보유현황표 */
function buildCoverSheet(
  workbook: ExcelJS.Workbook,
  all: ExtinguisherOverview[],
  sites: { id: string; name: string }[],
  typeNames: string[],
) {
  const sheet = workbook.addWorksheet("표지");
  // 표 폭: 사업장 + 종류들 + 합계
  const lastColCount = Math.max(2 + typeNames.length, 4);

  // 열 폭
  sheet.getColumn(1).width = 18;
  for (let c = 2; c <= lastColCount; c++) sheet.getColumn(c).width = 12;

  // 제목
  sheet.mergeCells(1, 1, 1, lastColCount);
  const title = sheet.getCell(1, 1);
  title.value = "소화기 점검 관리대장";
  title.font = { bold: true, size: 18 };
  title.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 32;

  // 점검일자 / 점검자 수기란
  const dateLabel = sheet.getCell(3, 1);
  dateLabel.value = "점검일자";
  dateLabel.font = { bold: true };
  dateLabel.alignment = { horizontal: "center", vertical: "middle" };
  dateLabel.border = THIN_BORDER;
  sheet.mergeCells(3, 2, 3, lastColCount);
  sheet.getCell(3, 2).border = THIN_BORDER;

  const inspectorLabel = sheet.getCell(4, 1);
  inspectorLabel.value = "점검자";
  inspectorLabel.font = { bold: true };
  inspectorLabel.alignment = { horizontal: "center", vertical: "middle" };
  inspectorLabel.border = THIN_BORDER;
  sheet.mergeCells(4, 2, 4, lastColCount);
  sheet.getCell(4, 2).border = THIN_BORDER;
  sheet.getRow(3).height = 24;
  sheet.getRow(4).height = 24;

  // 보유현황 제목
  const bohaTitle = sheet.getCell(6, 1);
  bohaTitle.value = "■ 보유현황";
  bohaTitle.font = { bold: true, size: 13 };

  // 표 헤더 (7행)
  const headerRowIdx = 7;
  const headers = ["사업장", ...typeNames.map(shortTypeName), "합계"];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(headerRowIdx, i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = THIN_BORDER;
  });

  // 사업장별 종류 카운트
  const countBySiteType = new Map<string, number>(); // `${siteId}|${typeName}`
  const totalBySite = new Map<string, number>();
  const totalByType = new Map<string, number>();
  let grandTotal = 0;
  for (const r of all) {
    if (!r.site_id || !r.extinguisher_type_name) continue;
    const key = `${r.site_id}|${r.extinguisher_type_name}`;
    countBySiteType.set(key, (countBySiteType.get(key) ?? 0) + 1);
    totalBySite.set(r.site_id, (totalBySite.get(r.site_id) ?? 0) + 1);
    totalByType.set(r.extinguisher_type_name, (totalByType.get(r.extinguisher_type_name) ?? 0) + 1);
    grandTotal += 1;
  }

  // 사업장 행
  let rowIdx = headerRowIdx + 1;
  for (const site of sites) {
    const cells: (string | number)[] = [site.name];
    for (const t of typeNames) cells.push(countBySiteType.get(`${site.id}|${t}`) ?? 0);
    cells.push(totalBySite.get(site.id) ?? 0);
    cells.forEach((v, i) => {
      const cell = sheet.getCell(rowIdx, i + 1);
      cell.value = v;
      cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
      cell.border = THIN_BORDER;
    });
    rowIdx += 1;
  }

  // 총계 행
  const totalCells: (string | number)[] = ["총계"];
  for (const t of typeNames) totalCells.push(totalByType.get(t) ?? 0);
  totalCells.push(grandTotal);
  totalCells.forEach((v, i) => {
    const cell = sheet.getCell(rowIdx, i + 1);
    cell.value = v;
    cell.font = { bold: true };
    cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F7" } };
    cell.border = THIN_BORDER;
  });
}

/** 사업장별 점검대장: 소화기 1대당 1행 (위치는 사업장명 제외) */
function buildLedgerSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: ExtinguisherOverview[],
  nameById: Map<string, string>,
) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { header: "관리번호", key: "asset_code", width: 18 },
    { header: "위치", key: "location", width: 40 },
    { header: "종류", key: "type", width: 14 },
    { header: "용량", key: "capacity", width: 10 },
    { header: "제조일", key: "manufacture_date", width: 12 },
    { header: "제조번호", key: "serial_no", width: 14 },
    { header: "내용연수(년)", key: "useful_life", width: 12 },
    { header: "교체예정일", key: "replace_due", width: 12 },
    { header: "내용연수상태", key: "lifecycle", width: 14 },
    { header: "최근점검일", key: "last_inspected", width: 12 },
    { header: "점검결과", key: "result", width: 10 },
    { header: "점검자", key: "inspector", width: 12 },
    { header: "이번달점검", key: "month", width: 10 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = THIN_BORDER;
  });

  for (const e of rows) {
    sheet.addRow({
      asset_code: e.asset_code,
      location: formatShortLocation(e),
      type: e.extinguisher_type_name ?? "",
      capacity: e.capacity ?? "",
      manufacture_date: e.manufacture_date ?? "",
      serial_no: e.serial_no ?? "",
      useful_life: e.useful_life_years ?? "",
      replace_due: e.replace_due_date ?? "",
      lifecycle: LIFECYCLE_STATUS_LABEL[e.lifecycle_status as LifecycleStatus] ?? "",
      last_inspected: e.last_inspected_at ? e.last_inspected_at.slice(0, 10) : "",
      result: resultLabel(e.last_inspection_result),
      inspector: e.last_inspector_id ? (nameById.get(e.last_inspector_id) ?? "") : "",
      month: e.inspected_this_month ? "O" : "X",
    });
  }

  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell((cell) => {
      cell.border = THIN_BORDER;
    });
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

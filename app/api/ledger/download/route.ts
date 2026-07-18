import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { LIFECYCLE_STATUS_LABEL } from "@/lib/utils/lifecycle";
import { formatShortLocation } from "@/lib/utils/location";
import { isAdminRole } from "@/lib/utils/roles";
import { sortByAssetCode } from "@/lib/utils/sort";
import type { LifecycleStatus } from "@/types/domain";

/**
 * 관리자 전용: 소화기 관리대장을 Excel(.xlsx)로 내려준다.
 * 소화기 1대당 1행이며, 최근 점검 정보(점검일·결과·점검자·이번달 점검 여부)를 함께 담는다.
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

  const { data: rows } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("status", "active");

  const all = sortByAssetCode(rows ?? []);

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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "소화기 점검 관리 시스템";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("소화기관리대장");

  sheet.columns = [
    { header: "관리번호", key: "asset_code", width: 18 },
    { header: "사업장", key: "site", width: 14 },
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

  // 헤더 스타일
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  const resultLabel = (r: string | null): string =>
    r === "normal" ? "정상" : r === "abnormal" ? "이상" : "미점검";

  for (const e of all) {
    sheet.addRow({
      asset_code: e.asset_code,
      site: e.site_name ?? "",
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
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `소화기관리대장_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ledger.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

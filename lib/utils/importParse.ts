/**
 * 소화기 일괄 등록 — 엑셀 한 줄을 DB에 넣을 수 있는 형태로 바꾸고 검증한다.
 *
 * 여기서 거르는 것은 "파일만 봐도 알 수 있는 잘못"이다(형식·필수값·오타).
 * 실제 등록과 사업장 경계는 fn_bulk_import_extinguishers가 책임진다.
 */

/** 템플릿 열 순서. 이 순서가 곧 템플릿 파일의 열 순서다. */
export const IMPORT_COLUMNS = [
  { key: "part", header: "관리파트", required: true, width: 14 },
  { key: "location_type", header: "위치구분", required: true, width: 10 },
  { key: "building_no", header: "건물", required: true, width: 10 },
  { key: "floor_code", header: "층", required: false, width: 8 },
  { key: "plate_no", header: "차량번호판", required: false, width: 14 },
  { key: "install_note", header: "설치위치", required: false, width: 22 },
  { key: "type_name", header: "종류", required: true, width: 18 },
  { key: "capacity", header: "용량", required: false, width: 10 },
  { key: "manufacture_date", header: "제조년월", required: true, width: 12 },
  { key: "serial_no", header: "제조번호", required: false, width: 14 },
  { key: "extinguisher_no", header: "관리번호 끝자리", required: false, width: 14 },
] as const;

export type ImportColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

/** fn_bulk_import_extinguishers에 넘길 한 행. */
export interface ImportRow {
  part: string;
  location_type: "BUILDING" | "VEHICLE";
  building_no: number;
  building_name: string;
  floor_code: string;
  floor_name: string;
  plate_no: string;
  vehicle_name: string;
  department: string;
  install_note: string;
  type_name: string;
  capacity: string;
  /** YYYY-MM-DD (해당 월 1일로 맞춘다) */
  manufacture_date: string;
  serial_no: string;
  /** 비우면 트리거가 자동 채번 */
  extinguisher_no: string;
}

export interface ImportIssue {
  /** 엑셀 행 번호(1-based, 헤더 포함) — 사용자가 파일에서 바로 찾을 수 있게 */
  row: number;
  column: string;
  message: string;
}

export interface ParseContext {
  partNames: string[];
  typeNames: string[];
  /** 이미 등록된 제조번호 (중복 경고용) */
  existingSerials: Set<string>;
}

export interface ParseResult {
  rows: ImportRow[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

/** 셀 값을 문자열로. 엑셀이 숫자·날짜로 읽은 칸도 사람이 적은 그대로에 가깝게 되돌린다. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  if (typeof value === "object") {
    // exceljs는 서식 있는 문자열을 { richText: [...] }, 수식을 { result } 로 준다.
    const obj = value as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (obj.richText) return obj.richText.map((t) => t.text).join("").trim();
    if (obj.text !== undefined) return String(obj.text).trim();
    if (obj.result !== undefined) return String(obj.result).trim();
    return "";
  }
  return String(value).trim();
}

/**
 * 제조년월을 YYYY-MM-DD(해당 월 1일)로. 명판에는 연·월까지만 찍혀 있어 일(day)은 받지 않는다.
 * 받아주는 형태: 2026-04 / 2026.4 / 2026/04 / 202604 / 엑셀 날짜 셀
 */
export function normalizeManufactureMonth(value: unknown): string | null {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth() + 1;
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }
  const text = cellText(value);
  if (!text) return null;

  const cleaned = text.replace(/\s/g, "");
  let y: number | null = null;
  let m: number | null = null;

  const sep = cleaned.match(/^(\d{4})[-./](\d{1,2})(?:[-./]\d{1,2})?$/);
  if (sep) {
    y = Number(sep[1]);
    m = Number(sep[2]);
  } else if (/^\d{6}$/.test(cleaned)) {
    y = Number(cleaned.slice(0, 4));
    m = Number(cleaned.slice(4));
  }

  if (y === null || m === null) return null;
  if (y < 1900 || y > 2200 || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** 아주 단순한 오타 제안 — 편집거리 1~2면 "혹시 이거?"로 보여준다. */
function closestName(input: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = editDistance(input, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  const limit = Math.max(1, Math.floor(input.length / 3));
  return best !== null && bestDist <= limit ? best : null;
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

/** 위치구분 표기 흔들림을 흡수한다(건물/BUILDING/건물소화기 …). */
function readLocationType(raw: string): "BUILDING" | "VEHICLE" | null {
  const v = raw.replace(/\s/g, "").toUpperCase();
  if (!v) return null;
  if (v.startsWith("건물") || v === "BUILDING" || v.startsWith("층")) return "BUILDING";
  if (v.startsWith("차") || v === "VEHICLE") return "VEHICLE";
  return null;
}

/**
 * 파싱된 셀 배열(헤더 제외)을 검증해 등록용 행으로 바꾼다.
 * @param records 각 원소는 `{ rowNumber, cells }` — rowNumber는 엑셀 실제 행 번호
 */
export function buildImportRows(
  records: { rowNumber: number; cells: Record<ImportColumnKey, unknown> }[],
  ctx: ParseContext
): ParseResult {
  const rows: ImportRow[] = [];
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const seenSerials = new Map<string, number>();
  const seenCodes = new Map<string, number>();

  for (const { rowNumber, cells } of records) {
    const text = (key: ImportColumnKey) => cellText(cells[key]);
    const fail = (column: string, message: string) => errors.push({ row: rowNumber, column, message });
    const warn = (column: string, message: string) => warnings.push({ row: rowNumber, column, message });
    const before = errors.length;

    // 관리파트 — 없으면 시스템관리자가 먼저 만들어야 한다(파트 쓰기는 시스템관리자 전용).
    const part = text("part");
    if (!part) {
      fail("관리파트", "비어 있습니다");
    } else if (!ctx.partNames.includes(part)) {
      const hint = closestName(part, ctx.partNames);
      fail(
        "관리파트",
        hint
          ? `"${part}"는 이 사업장에 없습니다 (${hint} 아닌가요?)`
          : `"${part}"는 이 사업장에 없습니다`
      );
    }

    const locationType = readLocationType(text("location_type"));
    if (!locationType) {
      fail("위치구분", `"${text("location_type")}" — 건물 또는 차량으로 적어주세요`);
    }

    const buildingRaw = text("building_no");
    const buildingNo = Number(buildingRaw.replace(/[^\d]/g, ""));
    if (!buildingRaw) {
      fail("건물", "비어 있습니다");
    } else if (!Number.isInteger(buildingNo) || buildingNo <= 0) {
      fail("건물", `"${buildingRaw}" — 건물번호(숫자)로 적어주세요`);
    }

    const floorCode = text("floor_code");
    const plateNo = text("plate_no");
    if (locationType === "BUILDING" && !floorCode) {
      fail("층", "건물 소화기는 층이 필요합니다");
    }
    if (locationType === "VEHICLE" && !plateNo) {
      fail("차량번호판", "차량 소화기는 번호판이 필요합니다");
    }
    if (floorCode === "차") {
      fail("층", '"차"는 차량 전용이라 층으로 쓸 수 없습니다 (위치구분을 차량으로)');
    }

    const typeName = text("type_name");
    if (!typeName) {
      fail("종류", "비어 있습니다");
    } else if (!ctx.typeNames.includes(typeName)) {
      const hint = closestName(typeName, ctx.typeNames);
      fail(
        "종류",
        hint ? `"${typeName}"는 등록된 종류가 아닙니다 (${hint} 아닌가요?)` : `"${typeName}"는 등록된 종류가 아닙니다`
      );
    }

    const manufactureDate = normalizeManufactureMonth(cells.manufacture_date);
    if (!manufactureDate) {
      const raw = text("manufacture_date") || String(cells.manufacture_date ?? "");
      fail("제조년월", `"${raw}" — 2026-04 형식으로 적어주세요`);
    }

    const extNoRaw = text("extinguisher_no");
    let extNo = "";
    if (extNoRaw) {
      const n = Number(extNoRaw);
      if (!Number.isInteger(n) || n <= 0 || n > 9999) {
        fail("관리번호 끝자리", `"${extNoRaw}" — 1~9999 사이 숫자이거나 비워두세요`);
      } else {
        extNo = String(n);
        // 파일 안에서 같은 관리번호를 두 번 지정하면 뒤엣것이 반드시 실패한다.
        const code = `${part}-${buildingNo}-${locationType === "VEHICLE" ? "차" : floorCode}-${n}`;
        const dup = seenCodes.get(code);
        if (dup) fail("관리번호 끝자리", `${dup}행과 관리번호가 겹칩니다 (${code})`);
        else seenCodes.set(code, rowNumber);
      }
    }

    // 제조번호 중복은 실제 데이터에도 있어(같은 날 같은 라인 생산) 막지 않고 알리기만 한다.
    const serialNo = text("serial_no");
    if (serialNo) {
      const dup = seenSerials.get(serialNo);
      if (dup) warn("제조번호", `${dup}행과 같은 제조번호입니다 (${serialNo})`);
      else {
        seenSerials.set(serialNo, rowNumber);
        if (ctx.existingSerials.has(serialNo)) {
          warn("제조번호", `이미 등록된 제조번호입니다 (${serialNo})`);
        }
      }
    }

    if (errors.length > before) continue;

    rows.push({
      part,
      location_type: locationType!,
      building_no: buildingNo,
      building_name: "",
      floor_code: locationType === "VEHICLE" ? "차" : floorCode,
      floor_name: "",
      plate_no: plateNo,
      vehicle_name: "",
      department: "",
      install_note: text("install_note"),
      type_name: typeName,
      capacity: text("capacity"),
      manufacture_date: manufactureDate!,
      serial_no: serialNo,
      extinguisher_no: extNo,
    });
  }

  return { rows, errors, warnings };
}

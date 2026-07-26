/** Postgres 유니크 제약(23505) 위반 시, 제약 이름별로 사람이 이해하기 쉬운 메시지로 바꾼다. */
const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  sites_org_code_key: "이미 사용 중인 관리기관 코드입니다. 다른 코드를 입력하세요.",
  management_parts_code_key: "이미 사용 중인 파트 코드입니다. 전체에서 유일한 코드를 입력하세요.",
  buildings_site_id_building_no_key: "이미 사용 중인 건물 번호입니다. 다른 번호를 입력하세요.",
  floors_building_id_floor_code_key: "이미 사용 중인 층 코드입니다. 다른 코드를 입력하세요.",
  vehicles_site_id_vehicle_no_key: "이미 사용 중인 차량 번호입니다. 다른 번호를 입력하세요.",
  extinguisher_types_name_key: "이미 존재하는 소화기 종류명입니다.",
  extinguishers_asset_code_key:
    "이미 사용 중인 관리번호입니다. 관리번호 끝자리를 비우면 자동으로 다음 번호가 부여됩니다.",
};

export function friendlyErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error);
  }
  const err = error as { code?: string; message?: string; details?: string | null };

  if (err.code === "23505") {
    for (const [constraint, message] of Object.entries(UNIQUE_CONSTRAINT_MESSAGES)) {
      if (err.message?.includes(constraint) || err.details?.includes(constraint)) {
        return message;
      }
    }
    return "이미 사용 중인 값입니다. 다른 값을 입력하세요.";
  }
  if (err.code === "23503") {
    // extinguishers.floor_id / vehicle_id는 on delete restrict — 소화기가 남아있으면 삭제 불가
    return "이 항목에 소속된 소화기가 있어 삭제할 수 없습니다. 소화기를 먼저 이동하거나 삭제하세요.";
  }
  if (err.code === "42501") {
    // RLS 정책 위반 — 점검자/관리자가 배정되지 않은 파트의 소화기에 접근한 경우
    return "이 소화기를 점검할 권한이 없습니다. 관리자에게 관리파트 배정을 요청하세요.";
  }
  if (typeof err.message === "string" && err.message) {
    return err.message;
  }
  return "알 수 없는 오류가 발생했습니다.";
}

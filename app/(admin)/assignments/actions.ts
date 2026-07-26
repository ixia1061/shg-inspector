"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";

/** 로그인 + 관리자 권한 확인 후 사용자(RLS) 클라이언트를 돌려준다. */
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) throw new Error("관리자만 사용할 수 있습니다");
  return { supabase };
}

/**
 * 관리자 전용: 점검자에게 "자기가 맡은 파트"의 점검 권한을 부여/해제한다.
 * RLS 사용자 클라이언트로 user_parts를 조작하므로, 관리자 경계(has_part_access)와
 * 대상=점검자 조건이 정책으로 자동 강제된다(다른 파트/다른 관리자에게는 실패).
 *
 * 화면(점검자 배정)은 사업장 단위 체크 하나로 보이지만, 실제로는 그 사업장에 속한
 * 관리파트 전체를 한 번에 부여/해제하는 것이다(파트가 여러 개면 partIds에 여러 개 전달).
 * "진짜 사업장 전체(user_sites)" 배정은 시스템관리자 전용(사용자 관리)으로 별도 유지된다 —
 * 이 액션은 항상 user_parts만 다루므로 관리자 경계를 벗어나지 않는다.
 */
export async function updateInspectorPartsAction(input: {
  inspectorId: string;
  partIds: string[];
  grant: boolean;
}) {
  const { supabase } = await assertAdmin();
  if (input.partIds.length === 0) return;

  if (input.grant) {
    const { error } = await supabase
      .from("user_parts")
      .upsert(input.partIds.map((part_id) => ({ user_id: input.inspectorId, part_id })));
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("user_parts")
      .delete()
      .eq("user_id", input.inspectorId)
      .in("part_id", input.partIds);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/assignments");
}

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
 */
export async function updateInspectorPartAction(input: {
  inspectorId: string;
  partId: string;
  grant: boolean;
}) {
  const { supabase } = await assertAdmin();

  if (input.grant) {
    const { error } = await supabase
      .from("user_parts")
      .upsert({ user_id: input.inspectorId, part_id: input.partId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("user_parts")
      .delete()
      .eq("user_id", input.inspectorId)
      .eq("part_id", input.partId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/assignments");
}

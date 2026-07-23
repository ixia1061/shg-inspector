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
  return { supabase, userId: user.id };
}

/**
 * 관리자 전용: 이상으로 기록된 최근 점검에 조치내용을 입력하고 조치완료 처리한다.
 * inspection_actions에 append(RLS 사용자 클라이언트 → 담당 사업장 범위로 한정).
 * 조치완료되면 그 소화기가 이번달 점검완료로 집계된다.
 */
export async function resolveInspectionAction(input: {
  inspectionId: string;
  extinguisherId: string;
  note: string;
}) {
  const note = input.note.trim();
  if (!note) throw new Error("조치내용을 입력해주세요");

  const { supabase, userId } = await assertAdmin();

  const { error } = await supabase.from("inspection_actions").insert({
    inspection_id: input.inspectionId,
    extinguisher_id: input.extinguisherId,
    action_note: note,
    resolved_by: userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/inspections");
  revalidatePath("/dashboard");
}

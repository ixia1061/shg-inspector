"use server";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validations/auth.schema";

/** 가입코드 정규화 — 현장에서 구두로 전달받아 입력하므로 공백·대소문자를 흡수한다. */
function normalizeJoinCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** 같은 접속지에서 10분 안에 이만큼 실패하면 잠시 막는다. */
const MAX_FAILURES = 10;
const WINDOW_MINUTES = 10;

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel은 x-forwarded-for 첫 항목이 실제 클라이언트 IP다.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * 점검자 가입 신청(비로그인 호출).
 *
 * 가입코드는 **관리자에게** 붙어 있다. 코드로 신청하면 그 관리자에게 접수되고, 관리자가
 * 승인할 때 자기 담당 사업장 중에서 골라 점검 권한을 준다.
 *
 * 브라우저의 supabase.auth.signUp()을 쓰지 않고 service_role로 계정을 만드는 이유:
 * signUp은 가입 메타데이터를 클라이언트가 정하므로 role을 심어 보낼 여지가 생기고,
 * Supabase의 공개 가입 설정을 열어야 한다. 여기서는 두 가지 다 필요 없다.
 * (트리거도 역할을 신뢰하지 않고 항상 "비활성 점검자"로 만든다 — 이중 방어)
 *
 * 만들어진 계정은 승인 전까지 is_active = false라 로그인해도 아무 데이터에 접근할 수 없다.
 */
export async function submitSignupAction(input: unknown): Promise<{ adminName: string }> {
  // 비로그인 진입점이므로 폼 검증을 믿지 않고 서버에서 다시 검증한다.
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "입력값을 확인하세요");
  }
  const { joinCode, name, email, password } = parsed.data;

  const admin = createAdminClient();
  const ip = await clientIp();

  // 가입코드가 4자리로 짧으므로, 같은 접속지에서 코드를 반복해 찍는 것을 막는다.
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: failures } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("attempted_at", since);

  if ((failures ?? 0) >= MAX_FAILURES) {
    throw new Error(
      `가입 시도가 너무 많습니다. ${WINDOW_MINUTES}분 후에 다시 시도하거나 관리자에게 문의하세요.`
    );
  }

  // 가입코드 → 관리자. 코드가 틀리면 여기서 끝나므로 계정은 만들어지지 않는다.
  const { data: joinRow } = await admin
    .from("admin_join_codes")
    .select("admin_id")
    .eq("code", normalizeJoinCode(joinCode))
    .maybeSingle();

  // 코드가 살아 있어도 그 관리자가 비활성이거나 점검자로 강등됐으면 접수하지 않는다.
  const { data: targetAdmin } = joinRow
    ? await admin
        .from("profiles")
        .select("id, name, role, is_active")
        .eq("id", joinRow.admin_id)
        .maybeSingle()
    : { data: null };
  const usable =
    !!targetAdmin &&
    targetAdmin.is_active &&
    (targetAdmin.role === "admin" || targetAdmin.role === "super_admin");

  await admin.from("signup_attempts").insert({ ip, success: usable });

  if (!usable) {
    throw new Error("가입코드가 올바르지 않습니다. 관리자에게 코드를 다시 확인하세요.");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 이메일 인증 절차를 두지 않는다(가입코드 + 관리자 승인으로 갈음)
    user_metadata: { name },
  });

  if (error || !data.user) {
    // 이미 가입된 이메일인지 여부는 Supabase 원문이 영어라 한국어로 바꿔 안내한다.
    const message = error?.message ?? "";
    if (/already|registered|exists/i.test(message)) {
      throw new Error("이미 가입된 이메일입니다. 로그인하거나 관리자에게 문의하세요.");
    }
    throw new Error(message || "가입 신청에 실패했습니다");
  }

  // 트리거가 만든 profile에 신청 정보를 채운다(role/is_active는 트리거가 정한 안전한 값 유지).
  const { error: profileError } = await admin
    .from("profiles")
    .update({ name, pending_admin_id: targetAdmin.id })
    .eq("id", data.user.id);

  // 신청 대상 관리자가 안 붙으면 어느 화면에도 안 보여 영영 승인받지 못하므로 되돌린다.
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error("가입 신청 저장에 실패했습니다. 잠시 후 다시 시도하세요.");
  }

  return { adminName: targetAdmin.name ?? "" };
}

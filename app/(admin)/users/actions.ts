"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    throw new Error("사용자 관리는 시스템관리자만 사용할 수 있습니다");
  }

  return user;
}

export async function createUserAction(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  siteIds: string[];
}) {
  await assertSuperAdmin();
  if (input.role !== "admin" && input.role !== "inspector") {
    throw new Error("허용되지 않은 역할입니다");
  }
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, role: input.role },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "사용자 생성에 실패했습니다");
  }

  // on_auth_user_created 트리거가 기본 role로 profile을 만들어두므로 실제 값으로 갱신한다.
  await admin.from("profiles").update({ role: input.role, name: input.name }).eq("id", data.user.id);

  if (input.siteIds.length > 0) {
    await admin
      .from("user_sites")
      .insert(input.siteIds.map((site_id) => ({ user_id: data.user!.id, site_id })));
  }

  revalidatePath("/users");
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  await assertSuperAdmin();
  if (role !== "admin" && role !== "inspector") {
    throw new Error("시스템관리자 역할은 부여할 수 없습니다");
  }

  const admin = createAdminClient();

  // 시스템관리자 계정의 역할은 강등할 수 없다 (최상위 권한 보호)
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "super_admin") {
    throw new Error("시스템관리자 계정의 역할은 변경할 수 없습니다");
  }

  await admin.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/users");
}

export async function updateUserSitesAction(userId: string, siteIds: string[]) {
  await assertSuperAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "super_admin") {
    throw new Error("시스템관리자는 모든 사업장에 접근하므로 배정이 필요 없습니다");
  }

  // 기존 배정을 전량 교체
  await admin.from("user_sites").delete().eq("user_id", userId);
  if (siteIds.length > 0) {
    await admin
      .from("user_sites")
      .insert(siteIds.map((site_id) => ({ user_id: userId, site_id })));
  }
  revalidatePath("/users");
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  await assertSuperAdmin();
  const admin = createAdminClient();

  // 시스템관리자 계정은 비활성화할 수 없다 (잠금 방지)
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "super_admin") {
    throw new Error("시스템관리자 계정은 비활성화할 수 없습니다");
  }

  await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);
  revalidatePath("/users");
}

export async function deleteUserAction(userId: string) {
  const currentUser = await assertSuperAdmin();

  if (currentUser.id === userId) {
    throw new Error("본인 계정은 삭제할 수 없습니다");
  }

  const admin = createAdminClient();

  // 시스템관리자 계정은 삭제할 수 없다 (최상위 권한 보호)
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "super_admin") {
    throw new Error("시스템관리자 계정은 삭제할 수 없습니다");
  }

  // 점검 이력이 있는 사용자는 감사 기록 보존을 위해 삭제 대신 비활성 처리를 유도한다.
  // (inspections.inspector_id가 on delete restrict라 DB에서도 막히지만, 먼저 친절하게 안내)
  const { count } = await admin
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .eq("inspector_id", userId);

  if ((count ?? 0) > 0) {
    throw new Error(
      `점검 이력이 ${count}건 있는 사용자는 삭제할 수 없습니다. 대신 '비활성' 처리하세요.`
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/users");
}

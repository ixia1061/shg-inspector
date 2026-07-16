"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다");

  return user;
}

export async function createUserAction(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  siteIds: string[];
}) {
  await assertAdmin();
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
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/users");
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);
  revalidatePath("/users");
}

export async function deleteUserAction(userId: string) {
  const currentUser = await assertAdmin();

  if (currentUser.id === userId) {
    throw new Error("본인 계정은 삭제할 수 없습니다");
  }

  const admin = createAdminClient();

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

"use server";

import { revalidatePath } from "next/cache";

import { getAccessibleSiteIds, getWritablePartIds } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";
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

/**
 * 로그인 + 관리자 확인. 일반 관리자도 점검자 생성·가입 승인을 할 수 있으므로
 * 여기서는 역할만 확인하고, "내 범위인가"는 각 액션이 파트 단위로 따로 검증한다.
 */
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) {
    throw new Error("관리자만 사용할 수 있습니다");
  }

  return { supabase, user, isSuper: profile?.role === "super_admin" };
}

/**
 * 넘어온 관리파트가 전부 내 권한 범위 안인지 확인한다(시스템관리자는 제한 없음).
 * 일반 관리자가 다른 사업장 파트를 실어 보내 권한을 넓히는 것을 막는 서버측 방어선 —
 * DB의 user_parts_write 정책도 같은 경계를 강제하지만, 여기서 먼저 안내 문구를 준다.
 */
async function assertGrantableParts(partIds: string[]) {
  if (partIds.length === 0) return;
  const writable = await getWritablePartIds();
  if (writable === null) return; // 시스템관리자
  const outside = partIds.filter((id) => !writable.has(id));
  if (outside.length > 0) {
    throw new Error("담당하지 않는 관리파트는 배정할 수 없습니다");
  }
}

export async function createUserAction(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  /** 사업장 "전체" 배정 — 시스템관리자만 지정할 수 있다. */
  siteIds: string[];
  /** 관리파트 단위 배정 — 일반 관리자가 점검자를 만들 때 쓰는 경로. */
  partIds?: string[];
}) {
  const { isSuper } = await assertAdmin();
  if (input.role !== "admin" && input.role !== "inspector") {
    throw new Error("허용되지 않은 역할입니다");
  }
  // 일반 관리자는 점검자만, 그것도 자기가 맡은 파트 범위로만 만들 수 있다.
  if (!isSuper && input.role !== "inspector") {
    throw new Error("관리자 계정 생성은 시스템관리자만 할 수 있습니다");
  }
  const siteIds = isSuper ? input.siteIds : [];
  const partIds = input.partIds ?? [];
  await assertGrantableParts(partIds);

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "사용자 생성에 실패했습니다");
  }
  const newUserId = data.user.id;

  // on_auth_user_created 트리거는 가입 메타데이터를 신뢰하지 않고 항상 "비활성 점검자"로
  // 만든다(자가 회원가입의 권한 상승 방지). 권한이 확인된 이 경로에서만 실제 값으로 올린다.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: input.role, name: input.name, is_active: true })
    .eq("id", newUserId);

  // profile 갱신이 실패하면 로그인은 되는데 아무것도 못 하는 계정이 남으므로 되돌린다.
  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId);
    throw new Error(profileError.message);
  }

  if (siteIds.length > 0) {
    await admin.from("user_sites").insert(siteIds.map((site_id) => ({ user_id: newUserId, site_id })));
  }
  if (partIds.length > 0) {
    await admin.from("user_parts").insert(partIds.map((part_id) => ({ user_id: newUserId, part_id })));
  }

  revalidatePath("/users");
}

/** 가입 신청 승인 — 계정을 활성화하고 지정한 관리파트의 점검 권한을 준다. */
export async function approveSignupAction(userId: string, partIds: string[]) {
  const { supabase } = await assertAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("role, is_active, pending_site_id")
    .eq("id", userId)
    .single();

  if (!target || target.role !== "inspector" || target.is_active || !target.pending_site_id) {
    throw new Error("승인 대기 중인 가입 신청이 아닙니다");
  }
  await assertGrantableParts(partIds);

  // 지정한 파트가 신청 사업장 소속인지 확인한다(다른 사업장 파트를 끼워 넣는 것 방지).
  if (partIds.length > 0) {
    const { data: parts } = await supabase
      .from("management_parts")
      .select("id, site_id")
      .in("id", partIds);
    if ((parts ?? []).some((p) => p.site_id !== target.pending_site_id)) {
      throw new Error("신청한 사업장의 관리파트만 배정할 수 있습니다");
    }
  }

  // RLS 사용자 클라이언트로 수행해 profiles_admin_approve_signup / user_parts_write
  // 정책이 관리자 경계를 DB에서도 강제하게 한다.
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: true, pending_site_id: null })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  if (partIds.length > 0) {
    const { error: partError } = await supabase
      .from("user_parts")
      .upsert(partIds.map((part_id) => ({ user_id: userId, part_id })));
    if (partError) throw new Error(partError.message);
  }

  revalidatePath("/users");
}

/** 가입 신청 거부 — 계정을 삭제한다(같은 이메일로 다시 신청할 수 있다). */
export async function rejectSignupAction(userId: string) {
  const { supabase } = await assertAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("role, is_active, pending_site_id")
    .eq("id", userId)
    .single();

  if (!target || target.role !== "inspector" || target.is_active || !target.pending_site_id) {
    throw new Error("승인 대기 중인 가입 신청이 아닙니다");
  }
  // 신청 사업장이 내 담당 범위인지 확인(파트 검증과 같은 기준).
  const writable = await getWritablePartIds();
  if (writable !== null) {
    const { data: parts } = await supabase
      .from("management_parts")
      .select("id")
      .eq("site_id", target.pending_site_id);
    const mine = (parts ?? []).some((p) => writable.has(p.id));
    if (!mine) throw new Error("담당하지 않는 사업장의 가입 신청입니다");
  }

  // 계정 삭제는 service_role로만 가능하다(profile은 FK cascade로 함께 삭제).
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath("/users");
}

/**
 * 점검자의 점검 범위를 **사업장 단위**로 교체한다(사용자 관리에서 바로 변경).
 *
 * 실제 DB 배정은 파트 단위(user_parts)지만, 파트가 많아 하나씩 고르기 번거로우므로
 * 화면에서는 사업장으로 묶는다. 내가 부여할 수 있는 파트만 대상으로 지우고 채우므로,
 * **다른 관리자가 준 범위는 건드리지 않는다.**
 * RLS 사용자 클라이언트로 수행해 user_parts_write 정책이 경계를 DB에서도 강제한다.
 */
export async function updateInspectorSitesAction(inspectorId: string, siteIds: string[]) {
  const { supabase } = await assertAdmin();

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", inspectorId)
    .single();
  if (target?.role !== "inspector") {
    throw new Error("점검자만 점검 범위를 지정할 수 있습니다");
  }
  await assertInspectorInMyScope(supabase, inspectorId);

  // 내가 부여할 수 있는 파트 = 이번 조작의 대상 범위
  const writable = await getWritablePartIds();
  const { data: allParts } = await supabase.from("management_parts").select("id, site_id");
  const grantable = (allParts ?? []).filter((p) => writable === null || writable.has(p.id));

  const selected = new Set(siteIds);
  const outside = siteIds.filter((id) => !grantable.some((p) => p.site_id === id));
  if (outside.length > 0) {
    throw new Error("담당하지 않는 사업장은 배정할 수 없습니다");
  }

  const toGrant = grantable.filter((p) => selected.has(p.site_id)).map((p) => p.id);
  const toRevoke = grantable.filter((p) => !selected.has(p.site_id)).map((p) => p.id);

  if (toRevoke.length > 0) {
    const { error } = await supabase
      .from("user_parts")
      .delete()
      .eq("user_id", inspectorId)
      .in("part_id", toRevoke);
    if (error) throw new Error(error.message);
  }
  if (toGrant.length > 0) {
    const { error } = await supabase
      .from("user_parts")
      .upsert(toGrant.map((part_id) => ({ user_id: inspectorId, part_id })));
    if (error) throw new Error(error.message);
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

export async function updateUserSitesAction(
  userId: string,
  siteIds: string[],
  partIds: string[] = []
) {
  await assertSuperAdmin();
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "super_admin") {
    throw new Error("시스템관리자는 모든 사업장에 접근하므로 배정이 필요 없습니다");
  }

  // 사업장 "전체" 배정(user_sites)과 특정 파트 배정(user_parts)을 함께 교체한다.
  // 전체 배정된 사업장의 파트는 중복이므로 제거한다.
  let effectiveParts: string[] = [];
  if (partIds.length > 0 && siteIds.length > 0) {
    const { data: parts } = await admin
      .from("management_parts")
      .select("id, site_id")
      .in("id", partIds);
    const wholeSites = new Set(siteIds);
    effectiveParts = (parts ?? [])
      .filter((p) => !wholeSites.has(p.site_id))
      .map((p) => p.id);
  } else {
    effectiveParts = partIds;
  }

  // 기존 배정을 전량 교체
  await admin.from("user_sites").delete().eq("user_id", userId);
  await admin.from("user_parts").delete().eq("user_id", userId);
  if (siteIds.length > 0) {
    await admin
      .from("user_sites")
      .insert(siteIds.map((site_id) => ({ user_id: userId, site_id })));
  }
  if (effectiveParts.length > 0) {
    await admin
      .from("user_parts")
      .insert(effectiveParts.map((part_id) => ({ user_id: userId, part_id })));
  }
  revalidatePath("/users");
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  const { supabase, isSuper } = await assertAdmin();
  const admin = createAdminClient();

  // 시스템관리자 계정은 비활성화할 수 없다 (잠금 방지)
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "super_admin") {
    throw new Error("시스템관리자 계정은 비활성화할 수 없습니다");
  }

  // 일반 관리자는 "자기 범위의 점검자"만 활성/비활성할 수 있다.
  if (!isSuper) {
    if (target?.role !== "inspector") {
      throw new Error("점검자 계정만 활성/비활성할 수 있습니다");
    }
    await assertInspectorInMyScope(supabase, userId);
  }

  await admin.from("profiles").update({ is_active: isActive }).eq("id", userId);
  revalidatePath("/users");
}

/**
 * 대상 점검자가 내 담당 범위인지 확인한다(시스템관리자는 이 함수를 거치지 않는다).
 * 사용자 관리 목록에 보이는 기준과 같다 — 배정이 내 범위와 겹치거나, 아직 아무 데도
 * 배정되지 않은(신규) 점검자. 화면에 보이는 대상만 조작할 수 있게 맞춘다.
 */
async function assertInspectorInMyScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const mySiteIds = await getAccessibleSiteIds();
  if (mySiteIds === null) return; // 시스템관리자

  const [{ data: theirSites }, { data: theirParts }, { data: allParts }] = await Promise.all([
    supabase.from("user_sites").select("site_id").eq("user_id", userId),
    supabase.from("user_parts").select("part_id").eq("user_id", userId),
    supabase.from("management_parts").select("id, site_id"),
  ]);

  const siteOfPart = new Map((allParts ?? []).map((p) => [p.id, p.site_id]));
  const theirSiteIds = new Set((theirSites ?? []).map((s) => s.site_id));
  for (const p of theirParts ?? []) {
    const siteId = siteOfPart.get(p.part_id);
    if (siteId) theirSiteIds.add(siteId);
  }

  if (theirSiteIds.size === 0) return; // 아직 미배정 — 첫 배정 대상이라 허용
  if (![...theirSiteIds].some((id) => mySiteIds.has(id))) {
    throw new Error("담당하지 않는 사업장의 점검자입니다");
  }
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

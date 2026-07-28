import { redirect } from "next/navigation";

import {
  UsersClient,
  type PendingSignupItem,
  type UserListItem,
} from "@/components/admin/UsersClient";
import { getWritablePartIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, isSuperAdminRole } from "@/lib/utils/roles";
import { sortSitesByPreference } from "@/lib/utils/sort";

export default async function UsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  if (!isAdminRole(me?.role)) redirect("/dashboard");
  const isSuper = isSuperAdminRole(me?.role);

  const [
    { data: profiles },
    { data: sites },
    { data: parts },
    { data: userSites },
    { data: userParts },
    { data: orderRow },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("sites").select("*").order("name"),
    supabase.from("management_parts").select("*").order("order_index"),
    supabase.from("user_sites").select("user_id, site_id"),
    supabase.from("user_parts").select("user_id, part_id"),
    user
      ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 내가 "사업장 전체"로 담당하는 곳 — 점검자에게도 사업장 한 줄로 넘길 수 있는 범위다.
  const { data: myWholeSites } = user
    ? await supabase.from("user_sites").select("site_id").eq("user_id", user.id)
    : { data: null };
  const myWholeSiteIds = isSuper
    ? (sites ?? []).map((s) => s.id)
    : (myWholeSites ?? []).map((s) => s.site_id);

  // 내가 부여할 수 있는 관리파트(= has_part_access). 시스템관리자는 null(제한 없음).
  const writablePartIds = await getWritablePartIds();
  const grantableParts = (parts ?? []).filter(
    (p) => writablePartIds === null || writablePartIds.has(p.id)
  );
  // 파트가 하나도 없는 사업장을 담당하는 경우까지 포함해 둔다.
  const mySiteIds = new Set([...grantableParts.map((p) => p.site_id), ...myWholeSiteIds]);

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));
  const partById = new Map((parts ?? []).map((p) => [p.id, p]));

  const siteIdsByUser = (userSites ?? []).reduce<Record<string, string[]>>((acc, us) => {
    (acc[us.user_id] ??= []).push(us.site_id);
    return acc;
  }, {});
  const partIdsByUser = (userParts ?? []).reduce<Record<string, string[]>>((acc, up) => {
    (acc[up.user_id] ??= []).push(up.part_id);
    return acc;
  }, {});

  /** 배정을 사업장 집합으로 환산 — 사업장 필터와 관리자 가시 범위 판단에 쓴다. */
  function sitesOf(userId: string): string[] {
    const ids = new Set(siteIdsByUser[userId] ?? []);
    for (const partId of partIdsByUser[userId] ?? []) {
      const part = partById.get(partId);
      if (part) ids.add(part.site_id);
    }
    return [...ids];
  }

  // 화면 표기: "한국공항공사 전체", "남부공항서비스 기계" 등
  function scopeLabelsFor(userId: string): string[] {
    const labels: string[] = [];
    for (const siteId of siteIdsByUser[userId] ?? []) {
      labels.push(`${siteNameById.get(siteId) ?? "?"} 전체`);
    }
    for (const partId of partIdsByUser[userId] ?? []) {
      const part = partById.get(partId);
      if (part) labels.push(`${siteNameById.get(part.site_id) ?? "?"} ${part.name}`);
    }
    return labels;
  }

  const toItem = (p: NonNullable<typeof profiles>[number]): UserListItem => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    isActive: p.is_active,
    scopeLabels: scopeLabelsFor(p.id),
    assignedSiteIds: siteIdsByUser[p.id] ?? [],
    assignedPartIds: partIdsByUser[p.id] ?? [],
    siteIds: sitesOf(p.id),
  });

  // 승인 대기 = 자가 회원가입으로 신청했고 아직 활성화되지 않은 계정
  const pendingProfiles = (profiles ?? []).filter((p) => !p.is_active && p.pending_site_id);
  const activeProfiles = (profiles ?? []).filter((p) => !(!p.is_active && p.pending_site_id));

  let admins: UserListItem[] = [];
  let inspectors: UserListItem[] = [];
  let pending: PendingSignupItem[] = [];

  if (isSuper) {
    admins = activeProfiles.filter((p) => isAdminRole(p.role)).map(toItem);
    inspectors = activeProfiles.filter((p) => p.role === "inspector").map(toItem);
    pending = pendingProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      siteId: p.pending_site_id!,
      siteName: siteNameById.get(p.pending_site_id!) ?? "?",
      requestedAt: p.created_at,
    }));
  } else {
    // 일반 관리자는 자기 담당 사업장의 점검자만 본다. 아직 아무 데도 배정되지 않은
    // 점검자는 누구나 볼 수 있게 남긴다(아직 아무도 안 맡은 사람이라 첫 배정이 가능해야 한다).
    // 주의: 배정 여부는 **user_sites·user_parts 행 자체**로 판단한다.
    // 파트 → 사업장 환산에 쓰는 management_parts는 RLS로 내 사업장 것만 읽히므로,
    // 다른 사업장 파트만 가진 점검자를 "미배정"으로 오인해 모두에게 노출하는 버그가 있었다.
    const myPartIds = new Set(grantableParts.map((p) => p.id));
    inspectors = activeProfiles
      .filter((p) => p.role === "inspector")
      .filter((p) => {
        const theirSites = siteIdsByUser[p.id] ?? [];
        const theirParts = partIdsByUser[p.id] ?? [];
        // 아직 아무 데도 배정되지 않은 점검자는 누구나 볼 수 있다(첫 배정 가능).
        if (theirSites.length === 0 && theirParts.length === 0) return true;
        return (
          theirSites.some((id) => mySiteIds.has(id)) || theirParts.some((id) => myPartIds.has(id))
        );
      })
      .map(toItem);
    pending = pendingProfiles
      .filter((p) => mySiteIds.has(p.pending_site_id!))
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        siteId: p.pending_site_id!,
        siteName: siteNameById.get(p.pending_site_id!) ?? "?",
        requestedAt: p.created_at,
      }));
  }

  // 사업장 버튼: 시스템관리자는 전체, 관리자는 담당 사업장만. 순서는 개인 설정을 따른다.
  const visibleSites = isSuper
    ? (sites ?? [])
    : (sites ?? []).filter((s) => mySiteIds.has(s.id));
  const orderedSites = sortSitesByPreference(visibleSites, orderRow?.site_order);

  return (
    <UsersClient
      isSuper={isSuper}
      sites={orderedSites}
      parts={parts ?? []}
      grantableParts={grantableParts}
      myWholeSiteIds={myWholeSiteIds}
      admins={admins}
      inspectors={inspectors}
      pending={pending}
    />
  );
}

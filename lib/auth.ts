import { createClient } from "@/lib/supabase/server";
import { isSuperAdminRole } from "@/lib/utils/roles";

/** 현재 로그인한 사용자의 역할(super_admin/admin/inspector)을 반환한다. 서버 컴포넌트/액션용. */
export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return data?.role ?? null;
}

/**
 * 현재 사용자가 접근할 수 있는 사업장 id 집합을 반환한다(= DB의 has_site_access).
 * - 시스템관리자: 전체 접근이므로 `null`(제한 없음).
 * - 일반 관리자: 사업장 전체 배정(user_sites) + 개별 파트 배정(user_parts)이 속한 사업장.
 * 사용자 관리에서 "내가 볼 수 있는 점검자·가입 신청"을 가려내는 데 쓴다.
 */
export async function getAccessibleSiteIds(): Promise<Set<string> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (isSuperAdminRole(profile?.role)) return null; // 제한 없음

  const [{ data: mySites }, { data: myParts }, { data: allParts }] = await Promise.all([
    supabase.from("user_sites").select("site_id").eq("user_id", user.id),
    supabase.from("user_parts").select("part_id").eq("user_id", user.id),
    supabase.from("management_parts").select("id, site_id"),
  ]);

  const siteIds = new Set((mySites ?? []).map((s) => s.site_id));
  const myPartIds = new Set((myParts ?? []).map((p) => p.part_id));
  for (const p of allParts ?? []) {
    if (myPartIds.has(p.id)) siteIds.add(p.site_id);
  }
  return siteIds;
}

/**
 * 현재 사용자가 소화기를 등록·관리할 수 있는 관리파트 id 집합을 반환한다(= DB의 has_part_access).
 * - 시스템관리자: 전체 접근이므로 `null`(제한 없음)을 반환한다.
 * - 일반 관리자: 사업장 전체 배정(user_sites)의 모든 파트 + 개별 배정(user_parts) 파트.
 * 소화기 등록 폼에서 관리파트 드롭다운을 권한 범위로 좁히는 데 쓴다.
 */
export async function getWritablePartIds(): Promise<Set<string> | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (isSuperAdminRole(profile?.role)) return null; // 제한 없음

  const [{ data: mySites }, { data: myParts }, { data: allParts }] = await Promise.all([
    supabase.from("user_sites").select("site_id").eq("user_id", user.id),
    supabase.from("user_parts").select("part_id").eq("user_id", user.id),
    supabase.from("management_parts").select("id, site_id"),
  ]);

  const mySiteIds = new Set((mySites ?? []).map((s) => s.site_id));
  const writable = new Set((myParts ?? []).map((p) => p.part_id));
  for (const p of allParts ?? []) {
    if (mySiteIds.has(p.site_id)) writable.add(p.id);
  }
  return writable;
}

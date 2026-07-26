import { redirect } from "next/navigation";

import { InspectorPartAssignments } from "@/components/admin/InspectorPartAssignments";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, isSuperAdminRole } from "@/lib/utils/roles";

export default async function AssignmentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  if (!isAdminRole(me?.role)) redirect("/dashboard");
  const isSuper = isSuperAdminRole(me?.role);

  const [{ data: sites }, { data: parts }, { data: inspectors }, { data: userParts }, { data: inspectorSites }] =
    await Promise.all([
      supabase.from("sites").select("id, name").order("name"),
      supabase.from("management_parts").select("*").order("order_index"),
      supabase.from("profiles").select("id, name").eq("role", "inspector").order("name"),
      supabase.from("user_parts").select("user_id, part_id"),
      supabase.from("user_sites").select("user_id, site_id"),
    ]);

  // 현재 관리자가 "부여 가능한" 파트 계산: 전체 배정 사업장의 모든 파트 + 개별 배정 파트.
  let grantableParts = parts ?? [];
  if (!isSuper && user) {
    const [{ data: mySites }, { data: myParts }] = await Promise.all([
      supabase.from("user_sites").select("site_id").eq("user_id", user.id),
      supabase.from("user_parts").select("part_id").eq("user_id", user.id),
    ]);
    const mySiteIds = new Set((mySites ?? []).map((s) => s.site_id));
    const myPartIds = new Set((myParts ?? []).map((p) => p.part_id));
    grantableParts = (parts ?? []).filter(
      (p) => mySiteIds.has(p.site_id) || myPartIds.has(p.id)
    );
  }

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));
  // 점검자별 현재 파트 배정 집합
  const partIdsByInspector = (userParts ?? []).reduce<Record<string, string[]>>((acc, up) => {
    (acc[up.user_id] ??= []).push(up.part_id);
    return acc;
  }, {});
  // 점검자별 "사업장 전체" 배정 집합 — 이 사업장의 파트는 개별 체크와 무관하게 이미 전체 접근권이 있다
  // (has_part_access가 user_sites만으로도 통과시키므로, 화면에서도 이를 명확히 보여준다).
  const siteIdsByInspector = (inspectorSites ?? []).reduce<Record<string, string[]>>((acc, us) => {
    (acc[us.user_id] ??= []).push(us.site_id);
    return acc;
  }, {});

  // 관리자가 다른 팀(자기 담당 범위 밖 사업장) 소속 점검자까지 이 화면에서 보고 권한을
  // 줄 수 있던 문제를 막는다: 점검자 목록을 "이미 내 담당 범위와 겹치는 배정이 있거나,
  // 아직 아무 데도 배정되지 않은(신규) 점검자"로만 좁힌다. 시스템관리자는 전체를 본다.
  let visibleInspectors = inspectors ?? [];
  if (!isSuper) {
    const grantableSiteIds = new Set(grantableParts.map((p) => p.site_id));
    const partSiteById = new Map((parts ?? []).map((p) => [p.id, p.site_id]));

    const assignedSiteIdsByInspector = new Map<string, Set<string>>();
    const addAssignment = (inspectorId: string, siteId: string | undefined) => {
      if (!siteId) return;
      let set = assignedSiteIdsByInspector.get(inspectorId);
      if (!set) {
        set = new Set();
        assignedSiteIdsByInspector.set(inspectorId, set);
      }
      set.add(siteId);
    };
    for (const us of inspectorSites ?? []) addAssignment(us.user_id, us.site_id);
    for (const up of userParts ?? []) addAssignment(up.user_id, partSiteById.get(up.part_id));

    visibleInspectors = (inspectors ?? []).filter((ins) => {
      const assignedSiteIds = assignedSiteIdsByInspector.get(ins.id);
      if (!assignedSiteIds || assignedSiteIds.size === 0) return true; // 아직 미배정 → 누구나 배정 가능
      return [...assignedSiteIds].some((id) => grantableSiteIds.has(id));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">점검자 배정</h1>
        <p className="text-muted-foreground text-sm">
          점검자에게 사업장 단위로 점검 권한을 부여합니다. 사업장을 체크하면 내가 맡은 그
          사업장의 관리파트 전체가 한 번에 부여되어, 그 사업장 소화기를 점검자가 스캔·점검할
          수 있습니다.
        </p>
      </div>

      <InspectorPartAssignments
        inspectors={visibleInspectors}
        grantableParts={grantableParts.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          site_id: p.site_id,
          site_name: siteNameById.get(p.site_id) ?? "?",
        }))}
        partIdsByInspector={partIdsByInspector}
        siteIdsByInspector={siteIdsByInspector}
      />
    </div>
  );
}

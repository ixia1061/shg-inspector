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
        inspectors={inspectors ?? []}
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

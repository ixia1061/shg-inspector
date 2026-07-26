import { InspectionStatusClient } from "@/components/admin/InspectionStatusClient";
import { createClient } from "@/lib/supabase/server";
import { sortSitesByPreference } from "@/lib/utils/sort";

export default async function InspectionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 점검 여부(이번달)가 필요하므로 overview 뷰를 쓴다. 한 번만 불러와
  // 사업장별 필터·건물별 점검률·미점검/점검완료 목록을 모두 클라이언트에서 계산한다.
  const [{ data: rows }, { data: sites }, { data: orderRow }] = await Promise.all([
    supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
    supabase.from("sites").select("*").order("name"),
    user
      ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 사업장 버튼 순서는 관리자 개인 설정(내 계정 → 사업장 표시 순서)을 따른다.
  const orderedSites = sortSitesByPreference(sites ?? [], orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">점검현황</h1>
      <InspectionStatusClient extinguishers={rows ?? []} sites={orderedSites} />
    </div>
  );
}

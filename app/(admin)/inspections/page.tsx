import { InspectionStatusClient } from "@/components/admin/InspectionStatusClient";
import { createClient } from "@/lib/supabase/server";

export default async function InspectionsPage() {
  const supabase = await createClient();

  // 점검 여부(이번달)가 필요하므로 overview 뷰를 쓴다. 한 번만 불러와
  // 사업장별 필터·건물별 점검률·미점검/점검완료 목록을 모두 클라이언트에서 계산한다.
  const [{ data: rows }, { data: sites }] = await Promise.all([
    supabase.from("v_extinguisher_overview").select("*").eq("status", "active"),
    supabase.from("sites").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">점검현황</h1>
      <InspectionStatusClient extinguishers={rows ?? []} sites={sites ?? []} />
    </div>
  );
}

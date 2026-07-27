import { LifecycleClient } from "@/components/admin/LifecycleClient";
import { createClient } from "@/lib/supabase/server";
import { sortByLifecycleUrgency, sortSitesByPreference } from "@/lib/utils/sort";

export default async function LifecyclePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: extinguishers }, { data: sites }, { data: orderRow }] = await Promise.all([
    supabase
      .from("v_extinguisher_overview")
      .select("*")
      .in("lifecycle_status", ["due_90", "due_30", "expired"]),
    supabase.from("sites").select("*").order("name"),
    user
      ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 급한 상태(만료 → 30일 → 90일) 우선, 같은 상태 안에서는 관리번호 자연 정렬.
  // DB의 order()는 문자열 정렬이라 "공사-1-1-10"이 "...-2"보다 앞에 오므로 여기서 정렬한다.
  const sorted = sortByLifecycleUrgency(extinguishers ?? []);

  // 사업장 버튼 순서는 관리자 개인 설정(내 계정 → 사업장 표시 순서)을 따른다.
  const orderedSites = sortSitesByPreference(sites ?? [], orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">내용연수 관리</h1>
        <p className="text-muted-foreground text-sm">
          교체 예정일이 90일 이내이거나 이미 만료된 소화기 목록입니다. 위 사업장 버튼으로 전환할 수
          있고, 만료 → 30일 → 90일 순서로 묶여 각 그룹 안에서는 관리번호 순으로 정렬됩니다.
        </p>
      </div>

      <LifecycleClient extinguishers={sorted} sites={orderedSites} />
    </div>
  );
}

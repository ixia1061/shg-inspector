import { InventoryClient } from "@/components/admin/InventoryClient";
import { createClient } from "@/lib/supabase/server";
import { sortSitesByPreference } from "@/lib/utils/sort";

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: extinguishers }, { data: sites }, { data: orderRow }] = await Promise.all([
    supabase.from("v_extinguisher_list").select("*").eq("status", "active"),
    supabase.from("sites").select("*").order("name"),
    user
      ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // 사업장 버튼 순서는 관리자 개인 설정(내 계정 → 사업장 표시 순서)을 따른다.
  const orderedSites = sortSitesByPreference(sites ?? [], orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">수량 현황</h1>
        <p className="text-muted-foreground text-sm">
          사용 중(active)인 소화기의 건물별 / 종류별 수량입니다. 위 사업장 버튼으로 전환할 수 있고,
          차량 소화기는 소속 건물 수량에 포함됩니다.
        </p>
      </div>

      <InventoryClient extinguishers={extinguishers ?? []} sites={orderedSites} />
    </div>
  );
}

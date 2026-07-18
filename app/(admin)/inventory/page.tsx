import { InventoryClient } from "@/components/admin/InventoryClient";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();

  const [{ data: extinguishers }, { data: sites }] = await Promise.all([
    supabase.from("v_extinguisher_list").select("*").eq("status", "active"),
    supabase.from("sites").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">수량 현황</h1>
        <p className="text-muted-foreground text-sm">
          사용 중(active)인 소화기의 건물별 / 종류별 수량입니다. 위 사업장 버튼으로 전환할 수 있고,
          차량 소화기는 소속 건물 수량에 포함됩니다.
        </p>
      </div>

      <InventoryClient extinguishers={extinguishers ?? []} sites={sites ?? []} />
    </div>
  );
}

import { ExtinguisherForm } from "@/components/admin/ExtinguisherForm";
import { getWritablePartIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NewExtinguisherPage() {
  const supabase = await createClient();

  const [
    { data: sites },
    { data: parts },
    { data: buildings },
    { data: floors },
    { data: vehicles },
    { data: types },
    writableParts,
  ] = await Promise.all([
    supabase.from("sites").select("*").order("name"),
    supabase.from("management_parts").select("*").order("order_index"),
    supabase.from("buildings").select("*").order("building_no"),
    supabase.from("floors").select("*").order("order_index"),
    supabase.from("vehicles").select("*").order("vehicle_no"),
    supabase.from("extinguisher_types").select("*").order("name"),
    getWritablePartIds(),
  ]);

  // 관리자는 자기 권한 범위(has_part_access) 파트만 등록할 수 있으므로 드롭다운도 그만큼 좁힌다.
  const visibleParts = writableParts
    ? (parts ?? []).filter((p) => writableParts.has(p.id))
    : (parts ?? []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">소화기 등록</h1>
      <ExtinguisherForm
        sites={sites ?? []}
        parts={visibleParts}
        buildings={buildings ?? []}
        floors={floors ?? []}
        vehicles={vehicles ?? []}
        types={types ?? []}
      />
    </div>
  );
}

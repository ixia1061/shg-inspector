import { ExtinguisherForm } from "@/components/admin/ExtinguisherForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewExtinguisherPage() {
  const supabase = await createClient();

  const [
    { data: sites },
    { data: buildings },
    { data: floors },
    { data: zones },
    { data: vehicles },
    { data: types },
  ] = await Promise.all([
    supabase.from("sites").select("*").order("name"),
    supabase.from("buildings").select("*").order("building_no"),
    supabase.from("floors").select("*").order("order_index"),
    supabase.from("zones").select("*").order("name"),
    supabase.from("vehicles").select("*").order("vehicle_no"),
    supabase.from("extinguisher_types").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">소화기 등록</h1>
      <ExtinguisherForm
        sites={sites ?? []}
        buildings={buildings ?? []}
        floors={floors ?? []}
        zones={zones ?? []}
        vehicles={vehicles ?? []}
        types={types ?? []}
      />
    </div>
  );
}

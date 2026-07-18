import { LifecycleList } from "@/components/admin/LifecycleList";
import { createClient } from "@/lib/supabase/server";

export default async function LifecyclePage() {
  const supabase = await createClient();

  const { data: extinguishers } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .in("lifecycle_status", ["due_90", "due_30", "expired"])
    .order("replace_due_date");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">내용연수 관리</h1>
        <p className="text-muted-foreground text-sm">
          교체 예정일이 90일 이내이거나 이미 만료된 소화기 목록입니다.
        </p>
      </div>

      <LifecycleList rows={extinguishers ?? []} />
    </div>
  );
}

import { LifecycleList } from "@/components/admin/LifecycleList";
import { createClient } from "@/lib/supabase/server";
import { compareAssetCode } from "@/lib/utils/sort";

export default async function LifecyclePage() {
  const supabase = await createClient();

  const { data: extinguishers } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .in("lifecycle_status", ["due_90", "due_30", "expired"])
    .order("replace_due_date");

  // 교체예정일이 같으면 관리번호 자연 정렬(가나다 → 숫자 순번)로 2차 정렬한다.
  // DB의 order()는 문자열 정렬이라 "공사-1-1-10"이 "...-2"보다 앞에 오는 문제가 있어
  // 여기서 compareAssetCode(localeCompare numeric)로 다시 정렬한다.
  const sorted = [...(extinguishers ?? [])].sort((a, b) => {
    const dateDiff = (a.replace_due_date ?? "").localeCompare(b.replace_due_date ?? "");
    if (dateDiff !== 0) return dateDiff;
    return compareAssetCode(a.asset_code, b.asset_code);
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">내용연수 관리</h1>
        <p className="text-muted-foreground text-sm">
          교체 예정일이 90일 이내이거나 이미 만료된 소화기 목록입니다.
        </p>
      </div>

      <LifecycleList rows={sorted} />
    </div>
  );
}

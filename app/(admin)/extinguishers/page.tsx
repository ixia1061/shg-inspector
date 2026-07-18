import Link from "next/link";

import { ExtinguisherListClient } from "@/components/admin/ExtinguisherListClient";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function ExtinguishersPage() {
  const supabase = await createClient();

  // 전체를 한 번만 불러오고, 필터·검색·페이지네이션은 클라이언트에서 즉시 처리한다.
  // (사업장 전환/검색 때마다 수백 행을 서버에서 다시 불러오던 버벅임 제거)
  const [{ data: extinguishers }, { data: sites }] = await Promise.all([
    supabase.from("v_extinguisher_overview").select("*"),
    supabase.from("sites").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">소화기 관리</h1>
        <Button nativeButton={false} render={<Link href="/extinguishers/new" />}>
          새 소화기 등록
        </Button>
      </div>

      <ExtinguisherListClient extinguishers={extinguishers ?? []} sites={sites ?? []} />
    </div>
  );
}

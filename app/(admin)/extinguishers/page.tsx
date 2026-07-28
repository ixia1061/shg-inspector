import Link from "next/link";

import { ExtinguisherListClient } from "@/components/admin/ExtinguisherListClient";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function ExtinguishersPage({
  searchParams,
}: {
  searchParams: Promise<{
    site?: string;
    part?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const supabase = await createClient();
  // 목록 상태를 주소에서 되살린다(상세 → 뒤로 왔을 때 보던 페이지·필터 유지).
  const sp = await searchParams;
  const initial = {
    site: sp.site ?? "all",
    part: sp.part ?? "all",
    status: sp.status ?? "all",
    q: sp.q ?? "",
    page: Math.max(0, (Number(sp.page) || 1) - 1),
  };

  // 전체를 한 번만 불러오고, 필터·검색·페이지네이션은 클라이언트에서 즉시 처리한다.
  // (사업장 전환/검색 때마다 수백 행을 서버에서 다시 불러오던 버벅임 제거)
  const [{ data: extinguishers }, { data: sites }, { data: parts }] = await Promise.all([
    supabase.from("v_extinguisher_list").select("*"),
    supabase.from("sites").select("*").order("name"),
    supabase.from("management_parts").select("*").order("order_index").order("code"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">소화기 관리</h1>
        <Button nativeButton={false} render={<Link href="/extinguishers/new" />}>
          새 소화기 등록
        </Button>
      </div>

      <ExtinguisherListClient
        extinguishers={extinguishers ?? []}
        sites={sites ?? []}
        parts={parts ?? []}
        initial={initial}
      />
    </div>
  );
}

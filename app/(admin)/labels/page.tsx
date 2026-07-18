import { QrBulkPrint } from "@/components/admin/QrBulkPrint";
import { createClient } from "@/lib/supabase/server";

// QR은 관리번호로 실시간 생성되므로, 목록만 항상 최신이면 QR도 최신이다.
// 소화기 등록/관리번호 변경이 바로 반영되도록 항상 최신 데이터를 서버에서 조회한다.
export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const supabase = await createClient();

  const [{ data: extinguishers }, { data: sites }] = await Promise.all([
    supabase.from("v_extinguisher_overview").select("*"),
    supabase.from("sites").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">QR 일괄 출력</h1>
        <p className="text-muted-foreground text-sm">
          필요한 소화기를 검색·선택해 QR 라벨을 한 번에 인쇄합니다.
        </p>
      </div>

      <QrBulkPrint extinguishers={extinguishers ?? []} sites={sites ?? []} />
    </div>
  );
}

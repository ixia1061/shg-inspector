import { offlineDB } from "@/lib/offline/db";
import { createClient } from "@/lib/supabase/client";

/** 같은 세션에서 너무 자주 다시 받지 않도록 하는 최소 간격 */
const PREWARM_INTERVAL_MS = 5 * 60 * 1000;
let lastPrewarmAt = 0;

/**
 * 담당 사업장의 활성 소화기 전체를 IndexedDB 캐시에 미리 적재한다.
 * - QR 스캔 → 점검 화면 진입 시 네트워크 왕복을 기다리지 않고 캐시에서 즉시 렌더링
 * - 오프라인 점검도 "온라인에서 미리 한 번 스캔"할 필요 없이 모든 소화기에 대해 가능해진다
 * RLS가 담당 사업장 데이터만 반환하므로 별도 필터는 필요 없다.
 */
export async function prewarmExtinguisherCache(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (Date.now() - lastPrewarmAt < PREWARM_INTERVAL_MS) return;
  lastPrewarmAt = Date.now();

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("v_extinguisher_overview")
      .select("*")
      .eq("status", "active");
    if (data?.length) {
      await offlineDB.extinguisherCache.bulkPut(data);
    }
  } catch {
    // 실패하면 다음 호출 때 다시 시도할 수 있게 되돌린다
    lastPrewarmAt = 0;
  }
}

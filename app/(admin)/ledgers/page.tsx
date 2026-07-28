import { redirect } from "next/navigation";

import { LedgerArchive, type LedgerMonth } from "@/components/admin/LedgerArchive";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";
import { sortSitesByPreference } from "@/lib/utils/sort";

/**
 * 관리대장 보관함 — 점검이 끝난 달의 대장을 사업장별로 골라 받는다.
 * 점검현황은 진행 중인 이번 달만 다루므로, 지난 달 기록은 이 화면에서 관리한다.
 * 목록은 RLS로 담당 사업장만 조회된다.
 */
export default async function LedgersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  if (!isAdminRole(me?.role)) redirect("/dashboard");

  const [{ data: sites }, { data: monthRows }, { data: extinguishers }, { data: orderRow }] =
    await Promise.all([
      supabase.from("sites").select("*").order("name"),
      supabase.from("v_ledger_months").select("*"),
      supabase.from("v_extinguisher_list").select("site_id").eq("status", "active"),
      user
        ? supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  // 사업장별 전체 소화기 수 — 그 달 점검률을 함께 보여주기 위함
  const totalBySite = new Map<string, number>();
  for (const e of extinguishers ?? []) {
    totalBySite.set(e.site_id, (totalBySite.get(e.site_id) ?? 0) + 1);
  }

  const months: LedgerMonth[] = (monthRows ?? []).map((m) => ({
    siteId: m.site_id,
    month: m.month,
    inspectedCount: m.inspected_count,
    totalCount: totalBySite.get(m.site_id) ?? 0,
  }));

  // 점검 기록이 있는 사업장만 보여준다(빈 사업장 버튼은 혼란만 준다).
  const siteIdsWithMonths = new Set(months.map((m) => m.siteId));
  const visibleSites = (sites ?? []).filter((s) => siteIdsWithMonths.has(s.id));
  const orderedSites = sortSitesByPreference(visibleSites, orderRow?.site_order);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">관리대장</h1>
        <p className="text-muted-foreground text-sm">
          달을 골라 그 달 기준 관리대장을 내려받습니다. 그 달의 점검일·점검사항(O/X)·불량내용·
          조치내용이 그대로 실려, 시간이 지나도 같은 내용으로 다시 받을 수 있습니다.
        </p>
      </div>

      <LedgerArchive
        sites={orderedSites}
        months={months}
        currentMonth={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 7)}
      />
    </div>
  );
}

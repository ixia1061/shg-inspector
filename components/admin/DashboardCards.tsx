import {
  AlertTriangle,
  CalendarCheck,
  ClipboardX,
  PackageSearch,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummaryView } from "@/lib/utils/dashboard";

/**
 * 카드마다 그 숫자를 이루는 목록 화면으로 이동한다(숫자만 보고는 내용을 알 수 없으므로).
 * `href`는 보고 있던 사업장을 `?site=`로 넘겨 도착 화면도 같은 사업장으로 열리게 한다.
 */
const CARD_DEFS: {
  key: keyof DashboardSummaryView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "destructive";
  href: (siteId: string) => string;
}[] = [
  {
    key: "total_extinguishers",
    label: "총 소화기",
    icon: PackageSearch,
    href: (s) => `/extinguishers?site=${s}`,
  },
  {
    key: "inspected_this_month",
    label: "이번달 점검완료",
    icon: CalendarCheck,
    href: (s) => `/inspections?site=${s}&tab=done`,
  },
  {
    key: "not_inspected_this_month",
    label: "이번달 미점검",
    icon: ClipboardX,
    tone: "warning",
    href: (s) => `/inspections?site=${s}&tab=month`,
  },
  {
    key: "action_required",
    label: "조치 필요",
    icon: Wrench,
    tone: "destructive",
    href: (s) => `/abnormal?site=${s}`,
  },
  {
    key: "due_soon",
    label: "교체예정",
    icon: ShieldAlert,
    tone: "warning",
    href: (s) => `/lifecycle?site=${s}`,
  },
  {
    key: "expired",
    label: "내용연수 만료",
    icon: AlertTriangle,
    tone: "destructive",
    href: (s) => `/lifecycle?site=${s}`,
  },
];

const TONE_CLASS: Record<string, string> = {
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-destructive",
  default: "text-foreground",
};

export function DashboardCards({
  summary,
  siteId,
}: {
  summary: DashboardSummaryView;
  /** 지금 보고 있는 사업장(또는 "전체") — 이동할 화면에 그대로 넘긴다 */
  siteId: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {CARD_DEFS.map(({ key, label, icon: Icon, tone = "default", href }) => (
        <Link key={key} href={href(siteId)} className="block">
          <Card className="hover:bg-accent h-full transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
              <Icon className={`size-4 ${TONE_CLASS[tone]}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${TONE_CLASS[tone]}`}>{summary[key]}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

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

const CARD_DEFS: {
  key: keyof DashboardSummaryView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "destructive";
  /** 누르면 내용을 볼 수 있는 카드 */
  href?: string;
}[] = [
  { key: "total_extinguishers", label: "총 소화기", icon: PackageSearch },
  { key: "inspected_this_month", label: "이번달 점검완료", icon: CalendarCheck },
  { key: "not_inspected_this_month", label: "이번달 미점검", icon: ClipboardX, tone: "warning" },
  // 숫자만 보고는 무슨 이상인지 알 수 없어 이상점검 화면으로 연결한다.
  { key: "action_required", label: "조치 필요", icon: Wrench, tone: "destructive", href: "/abnormal" },
  { key: "due_soon", label: "교체예정", icon: ShieldAlert, tone: "warning" },
  { key: "expired", label: "내용연수 만료", icon: AlertTriangle, tone: "destructive" },
];

const TONE_CLASS: Record<string, string> = {
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-destructive",
  default: "text-foreground",
};

export function DashboardCards({ summary }: { summary: DashboardSummaryView }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {CARD_DEFS.map(({ key, label, icon: Icon, tone = "default", href }) => {
        const card = (
          <Card className={href ? "hover:bg-accent h-full transition-colors" : undefined}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
              <Icon className={`size-4 ${TONE_CLASS[tone]}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${TONE_CLASS[tone]}`}>{summary[key]}</p>
              {href && <p className="text-muted-foreground mt-1 text-xs">눌러서 내용 보기</p>}
            </CardContent>
          </Card>
        );

        return href ? (
          <Link key={key} href={href} className="block">
            {card}
          </Link>
        ) : (
          <div key={key}>{card}</div>
        );
      })}
    </div>
  );
}

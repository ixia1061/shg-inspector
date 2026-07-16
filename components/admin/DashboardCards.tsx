import { AlertTriangle, CalendarCheck, ClipboardX, PackageSearch, ShieldAlert, Siren } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/types/domain";

const CARD_DEFS: {
  key: keyof DashboardSummary;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "destructive";
}[] = [
  { key: "total_extinguishers", label: "총 소화기", icon: PackageSearch },
  { key: "inspected_this_month", label: "이번달 점검", icon: CalendarCheck },
  { key: "not_inspected_this_month", label: "이번달 미점검", icon: ClipboardX, tone: "warning" },
  { key: "due_soon", label: "교체예정", icon: ShieldAlert, tone: "warning" },
  { key: "expired", label: "내용연수 만료", icon: AlertTriangle, tone: "destructive" },
  { key: "recent_abnormal", label: "최근 이상점검 (30일)", icon: Siren, tone: "destructive" },
];

const TONE_CLASS: Record<string, string> = {
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-destructive",
  default: "text-foreground",
};

export function DashboardCards({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {CARD_DEFS.map(({ key, label, icon: Icon, tone = "default" }) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
            <Icon className={`size-4 ${TONE_CLASS[tone]}`} />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${TONE_CLASS[tone]}`}>{summary[key]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

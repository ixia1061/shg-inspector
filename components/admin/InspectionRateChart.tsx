import type { InspectionRateRow } from "@/types/domain";

function rateColor(rate: number) {
  if (rate >= 80) return "bg-green-600";
  if (rate >= 50) return "bg-amber-500";
  return "bg-destructive";
}

export function InspectionRateChart({ rows }: { rows: InspectionRateRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">데이터가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.group_id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{row.group_name}</span>
            <span className="text-muted-foreground">
              {row.inspected}/{row.total} ({row.rate ?? 0}%)
            </span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${rateColor(row.rate ?? 0)}`}
              style={{ width: `${Math.min(row.rate ?? 0, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";

interface InspectionHistoryRow {
  id: string;
  inspected_at: string;
  overall_result: "normal" | "abnormal";
  memo: string | null;
  inspector_name: string;
  photo_count: number;
}

export function InspectionHistoryTimeline({ items }: { items: InspectionHistoryRow[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">점검 이력이 없습니다.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 border-b pb-3 last:border-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {new Date(item.inspected_at).toLocaleString("ko-KR")}
            </span>
            <Badge variant={item.overall_result === "normal" ? "secondary" : "destructive"}>
              {item.overall_result === "normal" ? "정상" : "이상"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            점검자: {item.inspector_name}
            {item.photo_count > 0 ? ` · 사진 ${item.photo_count}장` : ""}
          </p>
          {item.memo && <p className="text-sm">{item.memo}</p>}
        </li>
      ))}
    </ol>
  );
}

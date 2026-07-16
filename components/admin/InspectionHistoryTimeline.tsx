/* eslint-disable @next/next/no-img-element */
import { Badge } from "@/components/ui/badge";

interface InspectionHistoryRow {
  id: string;
  inspected_at: string;
  overall_result: "normal" | "abnormal";
  memo: string | null;
  inspector_name: string;
  /** 서명 URL 목록 (비공개 버킷이라 시간제한이 있는 링크) */
  photo_urls: string[];
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
            {item.photo_urls.length > 0 ? ` · 사진 ${item.photo_urls.length}장` : ""}
          </p>
          {item.memo && <p className="text-sm">{item.memo}</p>}
          {item.photo_urls.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {item.photo_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" title="원본 보기">
                  <img
                    src={url}
                    alt="점검 사진"
                    className="size-20 rounded-md border object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

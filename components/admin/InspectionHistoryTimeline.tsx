/* eslint-disable @next/next/no-img-element */
"use client";

import { formatKstDate } from "@/lib/utils/datetime";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/usePagination";

const PAGE_SIZE = 10;

interface InspectionHistoryRow {
  id: string;
  inspected_at: string;
  overall_result: "normal" | "abnormal";
  /** 점검자가 적은 이상(불량) 내용 */
  memo: string | null;
  /** 체크가 풀린 점검사항 목록. 정상이면 빈 문자열 */
  defect_items: string;
  inspector_name: string;
  /** 서명 URL 목록 (비공개 버킷이라 시간제한이 있는 링크) */
  photo_urls: string[];
  /** 이상 점검에 대한 조치 기록. 아직 조치 전이면 null */
  action: { note: string; resolved_at: string; resolved_by_name: string } | null;
}

export function InspectionHistoryTimeline({ items }: { items: InspectionHistoryRow[] }) {
  // items는 서버(상세 페이지)가 새로 내려줄 때만 참조가 바뀐다 — 관리자가 직접
  // 점검(AdminInspectDialog)해 이력 맨 앞에 새 점검이 추가되는 경우(router.refresh())가
  // 그 예. 참조가 바뀌면 1페이지로 되돌려 밀린 목록이 엉뚱하게 보이지 않게 한다.
  const { page: current, setPage, pageCount, pageRows: pageItems } = usePagination(
    items,
    PAGE_SIZE,
    items
  );

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">점검 이력이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {pageItems.map((item) => {
          const abnormal = item.overall_result === "abnormal";
          return (
            <li key={item.id} className="flex flex-col gap-1 border-b pb-3 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {formatKstDate(item.inspected_at)}
                </span>
                <Badge variant={abnormal ? "destructive" : "secondary"}>
                  {abnormal ? "이상" : "정상"}
                </Badge>
                {/* 이상 점검은 조치까지 마쳐야 그 달 점검완료로 잡힌다. 상태를 함께 보여준다. */}
                {abnormal &&
                  (item.action ? (
                    <Badge variant="secondary">조치완료</Badge>
                  ) : (
                    <Badge variant="outline">조치필요</Badge>
                  ))}
              </div>
              <p className="text-muted-foreground text-sm">
                점검자: {item.inspector_name}
                {item.photo_urls.length > 0 ? ` · 사진 ${item.photo_urls.length}장` : ""}
              </p>

              {item.defect_items && (
                <p className="text-sm">
                  <span className="text-muted-foreground">불량항목</span> {item.defect_items}
                </p>
              )}
              {item.memo && (
                <p className="text-sm">
                  <span className="text-muted-foreground">불량내용</span> {item.memo}
                </p>
              )}

              {/* 조치 내역 — 나중에 "어떻게 처리했는지" 확인하는 근거가 된다 */}
              {item.action && (
                <div className="border-primary/40 mt-1 border-l-2 pl-3">
                  <p className="text-sm">
                    <span className="text-muted-foreground">조치내용</span> {item.action.note}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatKstDate(item.action.resolved_at)} ·{" "}
                    {item.action.resolved_by_name}
                  </p>
                </div>
              )}

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
          );
        })}
      </ol>

      <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

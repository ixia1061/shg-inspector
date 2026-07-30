import Link from "next/link";

import { formatKstDate } from "@/lib/utils/datetime";
import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { formatShortLocation } from "@/lib/utils/location";
import type { ExtinguisherOverview } from "@/types/domain";

/**
 * 현황 목록 한 줄.
 * 관리자는 눌러서 바로 점검 화면으로 이동할 수 있고,
 * 점검자는 QR 스캔으로만 점검할 수 있으므로 정보 표시만 한다.
 */
export function ExtinguisherStatusRow({
  row,
  allowDirect,
  locationText,
}: {
  row: ExtinguisherOverview;
  allowDirect: boolean;
  /** 층별로 묶어 보여줄 때처럼 위치 일부가 이미 헤더에 있으면 짧게 바꿔 넘긴다. */
  locationText?: string;
}) {
  const location = locationText ?? formatShortLocation(row);
  const inner = (
    <>
      <div className="min-w-0">
        <p className="font-mono text-sm font-medium">{row.asset_code}</p>
        {location && <p className="text-muted-foreground truncate text-xs">{location}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <LifecycleStatusBadge status={row.lifecycle_status} />
        <span className="text-muted-foreground text-xs">
          {row.last_inspected_at
            ? formatKstDate(row.last_inspected_at)
            : "점검이력 없음"}
        </span>
      </div>
    </>
  );

  const className = "flex items-center justify-between gap-2 border-b px-1 py-3 last:border-0";

  if (!allowDirect) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <Link
      href={`/inspect/${encodeURIComponent(row.asset_code)}`}
      className={`hover:bg-accent ${className}`}
    >
      {inner}
    </Link>
  );
}

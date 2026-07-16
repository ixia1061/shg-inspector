import Link from "next/link";

import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { formatLocationPath } from "@/lib/utils/location";
import type { ExtinguisherOverview } from "@/types/domain";

/**
 * 현황 목록 한 줄.
 * 관리자는 눌러서 바로 점검 화면으로 이동할 수 있고,
 * 점검자는 QR 스캔으로만 점검할 수 있으므로 정보 표시만 한다.
 */
export function ExtinguisherStatusRow({
  row,
  allowDirect,
}: {
  row: ExtinguisherOverview;
  allowDirect: boolean;
}) {
  const inner = (
    <>
      <div className="min-w-0">
        <p className="font-mono text-sm font-medium">{row.asset_code}</p>
        <p className="text-muted-foreground truncate text-xs">{formatLocationPath(row)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <LifecycleStatusBadge status={row.lifecycle_status} />
        <span className="text-muted-foreground text-xs">
          {row.last_inspected_at
            ? new Date(row.last_inspected_at).toLocaleDateString("ko-KR")
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

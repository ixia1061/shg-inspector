"use client";

import { Button } from "@/components/ui/button";
import type { Site } from "@/types/domain";

/** "전체" 선택을 나타내는 값. 사업장 id와 겹치지 않는 고정 문자열. */
export const ALL_SITES = "all";

/**
 * 대시보드·통계 상단의 사업장 전환 버튼.
 * 여러 사업장을 담당하는 관리자는 한 화면에 다 섞여 보이면 읽기 어려우므로 사업장별로 나눠 본다.
 * 담당 사업장이 하나뿐이면 "전체"와 같은 화면이라 전체 버튼을 숨긴다.
 */
export function SiteFilterButtons({
  sites,
  value,
  onChange,
  counts,
}: {
  sites: Site[];
  value: string;
  onChange: (siteId: string) => void;
  /** 버튼에 함께 표시할 사업장별 건수(선택) */
  counts?: Map<string, number>;
}) {
  const showAll = sites.length > 1;

  return (
    <div className="flex flex-wrap gap-2">
      {showAll && (
        <Button
          variant={value === ALL_SITES ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(ALL_SITES)}
        >
          전체
        </Button>
      )}
      {sites.map((s) => (
        <Button
          key={s.id}
          variant={s.id === value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(s.id)}
        >
          {s.name}
          {counts ? (
            <span className="text-muted-foreground ml-1.5 text-xs">{counts.get(s.id) ?? 0}</span>
          ) : null}
        </Button>
      ))}
    </div>
  );
}

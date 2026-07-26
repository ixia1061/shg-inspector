"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateInspectorPartAction } from "@/app/(admin)/assignments/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GrantablePart {
  id: string;
  code: string;
  name: string;
  site_id: string;
  site_name: string;
}

/**
 * 점검자 × 부여가능 파트 매트릭스. 체크박스로 점검 권한을 즉시 부여/해제한다.
 *
 * 파트를 전부 한 표에 가로로 늘어놓으면 사업장이 여러 개일 때 열이 지나치게 많아지므로,
 * 점검현황 등 다른 관리자 화면과 동일하게 상단 "사업장 버튼"으로 전환해 그 사업장의
 * 파트만 보여준다.
 *
 * 사업장 "전체" 배정(user_sites)을 받은 점검자는 그 사업장의 모든 파트에 이미 접근권이
 * 있다(has_part_access가 user_sites만으로도 통과시킴) — 이 화면에서 파트를 체크/해제해도
 * 아무 효력이 없다. 그대로 빈 체크박스로 두면 "체크 안 했는데 점검이 됐다"는 혼동을 주므로,
 * 해당 칸은 "전체 배정됨"으로 표시하고 토글을 막는다.
 */
export function InspectorPartAssignments({
  inspectors,
  grantableParts,
  partIdsByInspector,
  siteIdsByInspector,
}: {
  inspectors: { id: string; name: string }[];
  grantableParts: GrantablePart[];
  partIdsByInspector: Record<string, string[]>;
  siteIdsByInspector: Record<string, string[]>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // 낙관적 로컬 상태: "userId::partId" Set
  const [granted, setGranted] = useState<Set<string>>(
    () =>
      new Set(
        Object.entries(partIdsByInspector).flatMap(([uid, pids]) =>
          pids.map((pid) => `${uid}::${pid}`)
        )
      )
  );

  // 부여 가능한 사업장 목록(파트가 처음 등장하는 순서 = order_index 기준 사업장 순서 유지)
  const sites = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of grantableParts) {
      if (!seen.has(p.site_id)) seen.set(p.site_id, p.site_name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [grantableParts]);

  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const selectedSiteId = sites.some((s) => s.id === siteId) ? siteId : (sites[0]?.id ?? "");
  const siteParts = useMemo(
    () => grantableParts.filter((p) => p.site_id === selectedSiteId),
    [grantableParts, selectedSiteId]
  );

  if (grantableParts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        부여할 수 있는 관리파트가 없습니다. 시스템관리자에게 담당 파트 배정을 요청하세요.
      </p>
    );
  }
  if (inspectors.length === 0) {
    return <p className="text-muted-foreground text-sm">등록된 점검자가 없습니다.</p>;
  }

  function toggle(inspectorId: string, part: GrantablePart, next: boolean) {
    const key = `${inspectorId}::${part.id}`;
    // 낙관적 업데이트
    setGranted((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
    startTransition(async () => {
      try {
        await updateInspectorPartAction({ inspectorId, partId: part.id, grant: next });
        router.refresh();
      } catch (err) {
        // 실패 시 롤백
        setGranted((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(key);
          else copy.add(key);
          return copy;
        });
        toast.error("권한 변경에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sites.map((s) => (
          <Button
            key={s.id}
            variant={s.id === selectedSiteId ? "default" : "outline"}
            size="sm"
            onClick={() => setSiteId(s.id)}
          >
            {s.name}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">점검자</TableHead>
              {siteParts.map((part) => (
                <TableHead key={part.id} className="text-center whitespace-nowrap">
                  {part.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">({part.code})</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {inspectors.map((ins) => {
              const wholeSiteAccess = (siteIdsByInspector[ins.id] ?? []).includes(selectedSiteId);
              return (
                <TableRow key={ins.id}>
                  <TableCell className="sticky left-0 bg-background font-medium">
                    {ins.name}
                  </TableCell>
                  {siteParts.map((part) => {
                    const key = `${ins.id}::${part.id}`;
                    return (
                      <TableCell key={part.id} className="text-center">
                        {wholeSiteAccess ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
                            title={`${part.site_name} 사업장 전체가 배정되어 있어 이 파트도 이미 점검 가능합니다. 파트 단위로 제한하려면 사용자 관리에서 "사업장 전체" 배정을 해제하고 특정 관리파트만 배정하세요.`}
                          >
                            <CircleCheck className="size-4" />
                            전체 배정됨
                          </span>
                        ) : (
                          <Checkbox
                            checked={granted.has(key)}
                            disabled={isPending}
                            onCheckedChange={(c) => toggle(ins.id, part, c === true)}
                          />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateInspectorPartsAction } from "@/app/(admin)/assignments/actions";
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
 * 점검자 × 사업장 매트릭스. 사업장 하나를 체크하면 그 사업장에 속한(내가 부여 가능한)
 * 관리파트 전체가 한 번에 부여/해제된다.
 *
 * 파트를 하나씩 열로 늘어놓으면(예: 남부공항서비스 6개 등) 파트 수가 많은 사업장에서
 * 표가 지나치게 복잡해지므로, 권한 체크의 단위를 "사업장"으로 낮췄다. 실제 DB에는
 * 여전히 파트 단위(user_parts)로 기록되므로 관리자 경계(has_part_access)를 벗어나지
 * 않는다 — "진짜 사업장 전체(user_sites)" 배정은 시스템관리자 전용(사용자 관리)으로
 * 별도 유지된다.
 *
 * 셀 상태 3가지:
 * - 전체 배정됨(초록 배지, 토글 불가): 시스템관리자가 이미 user_sites로 사업장 전체를
 *   배정한 경우 — 이 화면의 체크와 무관하게 이미 전체 접근권이 있다.
 * - 체크(파랑): 이 사업장의 부여 가능한 파트 전체가 그 점검자에게 부여됨.
 * - 일부(주황, indeterminate): 일부 파트만 부여됨(과거 파트 단위로 개별 부여했던 경우 등).
 *   클릭하면 나머지 파트까지 마저 부여해 "전체 체크" 상태로 통일한다.
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

  // 사업장별 그룹 (부여 가능한 파트가 있는 사업장만, 처음 등장 순서 유지)
  const sites = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of grantableParts) {
      if (!seen.has(p.site_id)) seen.set(p.site_id, p.site_name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [grantableParts]);

  const partsBySite = useMemo(() => {
    const map = new Map<string, GrantablePart[]>();
    for (const p of grantableParts) {
      const list = map.get(p.site_id);
      if (list) list.push(p);
      else map.set(p.site_id, [p]);
    }
    return map;
  }, [grantableParts]);

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

  function toggleSite(inspectorId: string, parts: GrantablePart[], next: boolean) {
    const keys = parts.map((p) => `${inspectorId}::${p.id}`);
    // 낙관적 업데이트
    setGranted((prev) => {
      const copy = new Set(prev);
      for (const key of keys) {
        if (next) copy.add(key);
        else copy.delete(key);
      }
      return copy;
    });
    startTransition(async () => {
      try {
        await updateInspectorPartsAction({
          inspectorId,
          partIds: parts.map((p) => p.id),
          grant: next,
        });
        router.refresh();
      } catch (err) {
        // 실패 시 롤백
        setGranted((prev) => {
          const copy = new Set(prev);
          for (const key of keys) {
            if (next) copy.delete(key);
            else copy.add(key);
          }
          return copy;
        });
        toast.error("권한 변경에 실패했습니다", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background">점검자</TableHead>
            {sites.map((s) => (
              <TableHead key={s.id} className="text-center whitespace-nowrap">
                {s.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspectors.map((ins) => {
            const wholeSites = new Set(siteIdsByInspector[ins.id] ?? []);
            return (
              <TableRow key={ins.id}>
                <TableCell className="sticky left-0 bg-background font-medium">
                  {ins.name}
                </TableCell>
                {sites.map((s) => {
                  const parts = partsBySite.get(s.id) ?? [];
                  const wholeSiteAccess = wholeSites.has(s.id);
                  const grantedCount = parts.filter((p) =>
                    granted.has(`${ins.id}::${p.id}`)
                  ).length;
                  const full = parts.length > 0 && grantedCount === parts.length;
                  const partial = grantedCount > 0 && !full;

                  return (
                    <TableCell key={s.id} className="text-center">
                      {wholeSiteAccess ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
                          title={`${s.name} 사업장 전체가 배정되어 있어 이미 점검 가능합니다. 파트 단위로 제한하려면 사용자 관리에서 "사업장 전체" 배정을 해제하세요.`}
                        >
                          <CircleCheck className="size-4" />
                          전체 배정됨
                        </span>
                      ) : (
                        <Checkbox
                          checked={full}
                          indeterminate={partial}
                          disabled={isPending}
                          title={
                            partial
                              ? `${grantedCount}/${parts.length}개 파트만 배정됨 — 클릭하면 나머지도 배정됩니다.`
                              : undefined
                          }
                          onCheckedChange={() => toggleSite(ins.id, parts, !full)}
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
  );
}

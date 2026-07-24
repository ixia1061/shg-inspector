"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateInspectorPartAction } from "@/app/(admin)/assignments/actions";
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

/** 점검자 × 부여가능 파트 매트릭스. 체크박스로 점검 권한을 즉시 부여/해제한다. */
export function InspectorPartAssignments({
  inspectors,
  grantableParts,
  partIdsByInspector,
}: {
  inspectors: { id: string; name: string }[];
  grantableParts: GrantablePart[];
  partIdsByInspector: Record<string, string[]>;
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 bg-background">점검자</TableHead>
            {grantableParts.map((part) => (
              <TableHead key={part.id} className="text-center whitespace-nowrap">
                <div className="text-xs font-normal text-muted-foreground">{part.site_name}</div>
                <div>
                  {part.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">({part.code})</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {inspectors.map((ins) => (
            <TableRow key={ins.id}>
              <TableCell className="sticky left-0 bg-background font-medium">{ins.name}</TableCell>
              {grantableParts.map((part) => {
                const key = `${ins.id}::${part.id}`;
                return (
                  <TableCell key={part.id} className="text-center">
                    <Checkbox
                      checked={granted.has(key)}
                      disabled={isPending}
                      onCheckedChange={(c) => toggle(ins.id, part, c === true)}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FloorFormDialog } from "@/components/admin/FloorFormDialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Floor } from "@/types/domain";

/**
 * 층 목록 + 선택 기반 순서 변경.
 * 층을 클릭해 선택한 뒤 상단의 고정된 ▲▼ 버튼을 누르면 한 칸씩 이동한다.
 * 버튼 위치가 고정되어 있어 여러 칸 이동할 때 연타만 하면 된다.
 * 이동은 로컬에 즉시 반영(낙관적)하고, 저장은 마지막 상태만 순차 반영한다.
 */
export function FloorList({
  buildingId,
  floors,
}: {
  buildingId: string;
  floors: Floor[];
}) {
  const [orderedFloors, setOrderedFloors] = useState(floors);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 연타 시 저장 요청이 겹치지 않도록: 최신 순서만 기억해두고 한 번에 하나씩 저장한다.
  const pendingRef = useRef<Floor[] | null>(null);
  const persistingRef = useRef(false);

  const selectedIndex = orderedFloors.findIndex((f) => f.id === selectedId);

  function schedulePersist(order: Floor[]) {
    pendingRef.current = order;
    if (persistingRef.current) return;
    persistingRef.current = true;

    void (async () => {
      const supabase = createClient();
      while (pendingRef.current) {
        const snapshot = pendingRef.current;
        pendingRef.current = null;
        const results = await Promise.all(
          snapshot.map((floor, i) =>
            supabase.from("floors").update({ order_index: i }).eq("id", floor.id)
          )
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) {
          toast.error("순서 저장에 실패했습니다. 새로고침 후 다시 시도하세요.", {
            description: failed.error.message,
          });
          pendingRef.current = null;
          break;
        }
      }
      persistingRef.current = false;
    })();
  }

  function move(offset: -1 | 1) {
    if (selectedIndex < 0) return;
    const target = selectedIndex + offset;
    if (target < 0 || target >= orderedFloors.length) return;

    const next = [...orderedFloors];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setOrderedFloors(next);
    schedulePersist(next);
  }

  return (
    <div className="mt-3 flex flex-col gap-2 pl-4">
      {orderedFloors.length > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="선택한 층을 위로 이동"
            disabled={selectedIndex <= 0}
            onClick={() => move(-1)}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="선택한 층을 아래로 이동"
            disabled={selectedIndex < 0 || selectedIndex === orderedFloors.length - 1}
            onClick={() => move(1)}
          >
            <ChevronDown className="size-4" />
          </Button>
          <span className="text-muted-foreground text-xs">
            {selectedIndex >= 0
              ? `"${orderedFloors[selectedIndex].name}" 선택됨 — 화살표로 이동`
              : "순서를 바꾸려면 층을 클릭해 선택하세요"}
          </span>
        </div>
      )}

      {orderedFloors.map((floor) => (
        <div
          key={floor.id}
          onClick={() => setSelectedId(floor.id === selectedId ? null : floor.id)}
          className={cn(
            "cursor-pointer rounded-md border-l pl-4 transition-colors",
            floor.id === selectedId && "bg-accent ring-primary/40 ring-1"
          )}
        >
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">
              {floor.name} <span className="text-muted-foreground">[{floor.floor_code}]</span>
            </span>
            <FloorFormDialog buildingId={buildingId} floor={floor} />
          </div>
        </div>
      ))}
      {orderedFloors.length === 0 && (
        <p className="text-muted-foreground text-xs">등록된 층이 없습니다.</p>
      )}
    </div>
  );
}

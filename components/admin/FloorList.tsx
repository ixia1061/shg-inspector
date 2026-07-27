"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * 저장이 끝나면 router.refresh()로 캐시를 비운다 — 층 순서는 소화기 등록·수정 폼의
 * 층 드롭다운에서도 쓰이는데, 캐시된 옛 순서가 남으면 그쪽에 반영되지 않는다.
 */
export function FloorList({
  buildingId,
  floors,
}: {
  buildingId: string;
  floors: Floor[];
}) {
  const router = useRouter();
  const [orderedFloors, setOrderedFloors] = useState(floors);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // 연타 시 저장 요청이 겹치지 않도록: 최신 순서만 기억해두고 한 번에 하나씩 저장한다.
  const pendingRef = useRef<Floor[] | null>(null);
  const persistingRef = useRef(false);
  // 저장 실패 시 되돌릴 기준(마지막으로 저장에 성공한 순서).
  const lastSavedRef = useRef(floors);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const selectedIndex = orderedFloors.findIndex((f) => f.id === selectedId);

  function schedulePersist(order: Floor[]) {
    pendingRef.current = order;
    if (persistingRef.current) return;
    persistingRef.current = true;

    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setStatus("saving");

    void (async () => {
      const supabase = createClient();
      let ok = true;
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
          ok = false;
          break;
        }
        // 연타로 여러 번 돌 수 있으므로 롤백 기준은 방금 저장한 스냅샷으로 갱신한다.
        lastSavedRef.current = snapshot;
      }
      persistingRef.current = false;

      if (!ok) {
        // 저장 못 한 순서가 화면에 남으면 실제 설정과 어긋나므로 되돌린다.
        setOrderedFloors(lastSavedRef.current);
        setStatus("idle");
        return;
      }

      setStatus("saved");
      savedTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
      // 소화기 등록·수정 폼의 층 드롭다운은 서버 컴포넌트라 클라이언트 캐시에 옛 순서가
      // 남는다. refresh로 캐시를 비워야 그 화면에도 바뀐 순서가 바로 보인다.
      router.refresh();
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

          {status !== "idle" && (
            <span
              aria-live="polite"
              className={cn(
                "flex shrink-0 items-center gap-1 text-xs",
                status === "saved" ? "text-primary" : "text-muted-foreground"
              )}
            >
              {status === "saving" ? (
                "저장 중…"
              ) : (
                <>
                  <Check className="size-3.5" /> 저장됨
                </>
              )}
            </span>
          )}
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

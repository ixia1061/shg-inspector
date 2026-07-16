"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface FloorOrderInfo {
  id: string;
  order_index: number;
}

/**
 * 층 목록에서 해당 층을 한 칸 위/아래로 이동시킨다.
 * 이동 시 건물 내 전체 층의 order_index를 0..n-1로 다시 매겨서,
 * 과거에 수동 입력으로 생긴 중복/비연속 순서값도 함께 정리된다.
 */
export function FloorReorderButtons({
  floors,
  index,
}: {
  floors: FloorOrderInfo[];
  index: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function move(offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= floors.length) return;

    const reordered = [...floors];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    startTransition(async () => {
      const supabase = createClient();
      const results = await Promise.all(
        reordered.map((floor, i) =>
          floor.order_index === i
            ? Promise.resolve({ error: null })
            : supabase.from("floors").update({ order_index: i }).eq("id", floor.id)
        )
      );

      const failed = results.find((r) => r.error);
      if (failed?.error) {
        toast.error("순서 변경에 실패했습니다", { description: failed.error.message });
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="flex items-center">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="위로 이동"
        disabled={isPending || index === 0}
        onClick={() => move(-1)}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="아래로 이동"
        disabled={isPending || index === floors.length - 1}
        onClick={() => move(1)}
      >
        <ChevronDown className="size-3.5" />
      </Button>
    </span>
  );
}

"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SiteOption {
  id: string;
  name: string;
}

/**
 * 점검현황·수량현황 상단 사업장 버튼의 표시 순서를 내 계정에서 개인적으로 설정한다.
 * FloorList(층 순서 변경)와 동일하게 "선택 후 고정된 ▲▼ 버튼"으로 이동한다.
 * 저장은 user_site_order 한 행에 배열 전체를 upsert(RLS로 본인 행만 조작 가능).
 */
export function SiteOrderEditor({ sites }: { sites: SiteOption[] }) {
  const [ordered, setOrdered] = useState(sites);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 연타 시 저장 요청이 겹치지 않도록: 최신 순서만 기억해두고 한 번에 하나씩 저장한다.
  const pendingRef = useRef<string[] | null>(null);
  const persistingRef = useRef(false);

  const selectedIndex = ordered.findIndex((s) => s.id === selectedId);

  function schedulePersist(order: string[]) {
    pendingRef.current = order;
    if (persistingRef.current) return;
    persistingRef.current = true;

    void (async () => {
      const supabase = createClient();
      while (pendingRef.current) {
        const snapshot = pendingRef.current;
        pendingRef.current = null;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) break;
        const { error } = await supabase
          .from("user_site_order")
          .upsert({ user_id: user.id, site_order: snapshot });
        if (error) {
          toast.error("순서 저장에 실패했습니다. 새로고침 후 다시 시도하세요.", {
            description: error.message,
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
    if (target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setOrdered(next);
    schedulePersist(next.map((s) => s.id));
  }

  if (sites.length === 0) {
    return <p className="text-muted-foreground text-sm">배정된 사업장이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {ordered.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="선택한 사업장을 위로 이동"
            disabled={selectedIndex <= 0}
            onClick={() => move(-1)}
            className="border-input hover:bg-accent flex size-8 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label="선택한 사업장을 아래로 이동"
            disabled={selectedIndex < 0 || selectedIndex === ordered.length - 1}
            onClick={() => move(1)}
            className="border-input hover:bg-accent flex size-8 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronDown className="size-4" />
          </button>
          <span className="text-muted-foreground text-xs">
            {selectedIndex >= 0
              ? `"${ordered[selectedIndex].name}" 선택됨 — 화살표로 이동`
              : "순서를 바꾸려면 사업장을 눌러 선택하세요"}
          </span>
        </div>
      )}

      <ol className="flex flex-col gap-1">
        {ordered.map((site, i) => (
          <li
            key={site.id}
            onClick={() => setSelectedId(site.id === selectedId ? null : site.id)}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              site.id === selectedId ? "border-primary bg-accent" : "border-transparent"
            )}
          >
            <span className="text-muted-foreground w-5 text-right font-mono text-xs">{i + 1}</span>
            {site.name}
          </li>
        ))}
      </ol>
    </div>
  );
}

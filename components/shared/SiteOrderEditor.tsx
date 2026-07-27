"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface SiteOption {
  id: string;
  name: string;
}

/**
 * 관리 화면 상단 사업장 버튼의 표시 순서를 내 계정에서 개인적으로 설정한다.
 * FloorList(층 순서 변경)와 동일하게 "선택 후 고정된 ▲▼ 버튼"으로 이동한다.
 * 저장은 user_site_order 한 행에 배열 전체를 upsert(RLS로 본인 행만 조작 가능).
 * 이동할 때마다 자동 저장하고, 저장이 끝나면 router.refresh()로 다른 화면의 캐시를 비운다.
 */
export function SiteOrderEditor({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const [ordered, setOrdered] = useState(sites);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  // 연타 시 저장 요청이 겹치지 않도록: 최신 순서만 기억해두고 한 번에 하나씩 저장한다.
  const pendingRef = useRef<SiteOption[] | null>(null);
  const persistingRef = useRef(false);
  // 저장 실패 시 되돌릴 기준(마지막으로 저장에 성공한 순서).
  const lastSavedRef = useRef(sites);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const selectedIndex = ordered.findIndex((s) => s.id === selectedId);

  function schedulePersist(order: SiteOption[]) {
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          ok = false;
          break;
        }
        const { error } = await supabase.from("user_site_order").upsert({
          user_id: user.id,
          site_order: snapshot.map((s) => s.id),
          updated_at: new Date().toISOString(),
        });
        if (error) {
          toast.error("순서 저장에 실패했습니다. 새로고침 후 다시 시도하세요.", {
            description: error.message,
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
        setOrdered(lastSavedRef.current);
        setStatus("idle");
        return;
      }

      setStatus("saved");
      savedTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
      // 다른 화면(점검현황·대시보드 등)은 서버 컴포넌트라 클라이언트 캐시에 옛 순서가 남는다.
      // refresh로 캐시를 비워야 뒤로 갔을 때 바뀐 순서가 바로 보인다.
      router.refresh();
    })();
  }

  function move(offset: -1 | 1) {
    if (selectedIndex < 0) return;
    const target = selectedIndex + offset;
    if (target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setOrdered(next);
    schedulePersist(next);
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

          {status !== "idle" && (
            <span
              aria-live="polite"
              className={cn(
                "ml-auto flex shrink-0 items-center gap-1 text-xs",
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

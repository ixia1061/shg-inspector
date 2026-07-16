"use client";

import { useEffect, useState } from "react";

import { offlineDB } from "@/lib/offline/db";
import { createClient } from "@/lib/supabase/client";
import type { ExtinguisherOverview } from "@/types/domain";

/**
 * QR 스캔 직후 소화기 정보를 조회한다.
 * 온라인이면 서버에서 최신 정보를 가져와 캐시에 저장하고,
 * 오프라인이거나 조회에 실패하면 IndexedDB 캐시(이전에 온라인 상태에서 조회된 값)로 폴백한다.
 */
export function useExtinguisherLookup(qrToken: string) {
  const [data, setData] = useState<ExtinguisherOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      if (navigator.onLine) {
        try {
          const supabase = createClient();
          const { data: row } = await supabase
            .from("v_extinguisher_overview")
            .select("*")
            .eq("qr_token", qrToken)
            .maybeSingle();

          if (row) {
            if (!cancelled) {
              setData(row);
              setFromCache(false);
              setLoading(false);
            }
            await offlineDB.extinguisherCache.put(row);
            return;
          }
        } catch {
          // 네트워크 오류 등 — 아래 캐시 폴백으로 이어진다.
        }
      }

      const cached = await offlineDB.extinguisherCache.get(qrToken);
      if (!cancelled) {
        if (cached) {
          setData(cached);
          setFromCache(true);
        } else {
          setError("소화기 정보를 찾을 수 없습니다. 온라인 상태에서 먼저 한 번 스캔해야 합니다.");
        }
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [qrToken]);

  return { data, loading, error, fromCache };
}

"use client";

import { useEffect, useState } from "react";

import { offlineDB } from "@/lib/offline/db";
import { createClient } from "@/lib/supabase/client";
import type { ExtinguisherOverview } from "@/types/domain";

/**
 * QR 스캔 직후 소화기 정보를 관리번호(asset_code)로 조회한다.
 * 온라인이면 서버에서 최신 정보를 가져와 캐시에 저장하고,
 * 오프라인이거나 조회에 실패하면 IndexedDB 캐시(이전에 온라인 상태에서 조회된 값)로 폴백한다.
 * 스캔한 코드가 현재 관리번호와 일치하지 않으면(과거에 변경된 관리번호) 이력 테이블에서
 * 재조회해 항상 최신 소화기 정보로 연결한다 — QR은 재발급하지 않는 것이 원칙이기 때문이다.
 */
export function useExtinguisherLookup(assetCode: string) {
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
          let row: ExtinguisherOverview | null = null;

          const { data: current } = await supabase
            .from("v_extinguisher_overview")
            .select("*")
            .eq("asset_code", assetCode)
            .maybeSingle();

          if (current) {
            row = current;
          } else {
            const { data: resolvedId } = await supabase.rpc("fn_find_extinguisher_id_by_code", {
              p_code: assetCode,
            });

            if (resolvedId) {
              const { data: byId } = await supabase
                .from("v_extinguisher_overview")
                .select("*")
                .eq("id", resolvedId)
                .maybeSingle();
              row = byId ?? null;
            }
          }

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

      const cached = await offlineDB.extinguisherCache.where("asset_code").equals(assetCode).first();

      if (!cancelled) {
        if (cached) {
          setData(cached);
          setFromCache(true);
        } else {
          setError(
            navigator.onLine
              ? `등록되지 않은 QR 코드입니다. (스캔된 관리번호: ${assetCode})`
              : "오프라인 상태이고 캐시된 정보가 없습니다. 온라인 상태에서 먼저 한 번 스캔해야 합니다."
          );
        }
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [assetCode]);

  return { data, loading, error, fromCache };
}

"use client";

import { useEffect, useState } from "react";

import { offlineDB } from "@/lib/offline/db";
import { createClient } from "@/lib/supabase/client";
import type { ExtinguisherOverview } from "@/types/domain";

/**
 * QR 스캔 직후 소화기 정보를 관리번호(asset_code)로 조회한다.
 *
 * 캐시 우선(stale-while-revalidate) 전략:
 * 1. IndexedDB 캐시에 있으면 즉시 렌더링 (스캔 → 점검 화면이 체감상 즉시 열림)
 * 2. 온라인이면 백그라운드에서 서버 최신값으로 갱신하고 캐시에 반영
 * 3. 서버 조회가 실패(오프라인 등)하면 캐시 데이터임을 표시(fromCache)
 *
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

      // 1) 캐시 즉시 표시 — 네트워크를 기다리지 않는다
      const cached = await offlineDB.extinguisherCache
        .where("asset_code")
        .equals(assetCode)
        .first();
      if (cached && !cancelled) {
        setData(cached);
        setFromCache(false); // 온라인 갱신이 이어질 수 있으므로 아직 배지는 띄우지 않는다
        setLoading(false);
      }

      // 2) 온라인이면 최신값으로 갱신
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

          // 서버에 존재하지 않는 코드 — 캐시가 있었다면 삭제된 소화기일 수 있으나,
          // 점검 자체는 캐시 기준으로 진행 가능하게 둔다(서버가 최종 검증).
          if (!cached && !cancelled) {
            setError(`등록되지 않은 QR 코드입니다. (스캔된 관리번호: ${assetCode})`);
            setLoading(false);
          }
          return;
        } catch {
          // 네트워크 오류 등 — 아래 오프라인 폴백으로 이어진다.
        }
      }

      // 3) 오프라인(또는 조회 실패) — 캐시 데이터임을 표시
      if (!cancelled) {
        if (cached) {
          setFromCache(true);
        } else {
          setError(
            "오프라인 상태이고 캐시된 정보가 없습니다. 온라인 상태에서 앱을 한 번 열어두면 자동으로 저장됩니다."
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

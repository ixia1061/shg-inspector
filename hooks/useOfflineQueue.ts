"use client";

import { useCallback, useEffect, useState } from "react";

import { countPendingInspections } from "@/lib/offline/outbox";
import { flushOutbox, registerAutoSync } from "@/lib/offline/syncEngine";

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    setPendingCount(await countPendingInspections());
  }, []);

  useEffect(() => {
    let cancelled = false;

    countPendingInspections().then((count) => {
      if (!cancelled) setPendingCount(count);
    });

    const unregister = registerAutoSync();
    const interval = setInterval(() => {
      countPendingInspections().then((count) => {
        if (!cancelled) setPendingCount(count);
      });
    }, 5000);

    return () => {
      cancelled = true;
      unregister();
      clearInterval(interval);
    };
  }, []);

  const sync = useCallback(async () => {
    const result = await flushOutbox();
    await refresh();
    return result;
  }, [refresh]);

  return { pendingCount, sync, refresh };
}

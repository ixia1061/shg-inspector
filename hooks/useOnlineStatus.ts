"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * 온라인 여부. useSyncExternalStore를 쓰면 서버 렌더(항상 true)와
 * 클라이언트 하이드레이션이 어긋나지 않는다 (hydration mismatch 방지).
 */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}

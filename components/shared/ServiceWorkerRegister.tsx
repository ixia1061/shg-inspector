"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 등록 실패는 조용히 무시 — 오프라인 캐싱만 못 쓸 뿐 앱 자체는 정상 동작한다.
      });
    }
  }, []);

  return null;
}

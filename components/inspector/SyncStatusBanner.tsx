"use client";

import { CloudUpload, WifiOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { prewarmExtinguisherCache } from "@/lib/offline/prewarm";

export function SyncStatusBanner() {
  const isOnline = useOnlineStatus();
  const { pendingCount, sync } = useOfflineQueue();

  // 점검자 화면 어디서든 접속만 하면 소화기 정보를 미리 캐시해 둔다
  // (QR 스캔 시 즉시 렌더링 + 오프라인 점검 대비). 내부에서 호출 빈도를 스로틀링한다.
  useEffect(() => {
    void prewarmExtinguisherCache();
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <span className="flex items-center gap-2">
        {!isOnline ? <WifiOff className="size-4" /> : <CloudUpload className="size-4" />}
        {!isOnline
          ? "오프라인 상태입니다. 점검 결과는 온라인 연결 시 자동 전송됩니다."
          : `동기화 대기 중인 점검 ${pendingCount}건`}
      </span>
      {isOnline && pendingCount > 0 && (
        <Button size="sm" variant="secondary" onClick={() => void sync()}>
          지금 동기화
        </Button>
      )}
    </div>
  );
}

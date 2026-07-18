import { Loader2 } from "lucide-react";

/** 앱 전역 로딩 폴백 — 화면 전환/진입 중 흰 화면 대신 즉시 표시된다. */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="text-muted-foreground size-8 animate-spin" />
    </div>
  );
}

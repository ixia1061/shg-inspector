import { CheckCircle2, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default async function InspectCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { result } = await searchParams;
  const isAbnormal = result === "abnormal";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      {isAbnormal ? (
        <TriangleAlert className="text-destructive size-20" />
      ) : (
        <CheckCircle2 className="size-20 text-green-600" />
      )}
      <div>
        <h1 className="text-2xl font-bold">
          {isAbnormal ? "이상사항이 기록되었습니다" : "점검이 완료되었습니다"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">수고하셨습니다</p>
      </div>
      <Button size="lg" className="h-14 w-full max-w-xs text-lg" render={<Link href="/scan" />}>
        다음 소화기 스캔
      </Button>
    </div>
  );
}

"use client";

import { use } from "react";

import { InspectionChecklist } from "@/components/inspector/InspectionChecklist";
import { Skeleton } from "@/components/ui/skeleton";
import { useExtinguisherLookup } from "@/hooks/useExtinguisherLookup";

export default function InspectPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = use(params);
  const { data, loading, error, fromCache } = useExtinguisherLookup(qrToken);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-destructive font-medium">{error ?? "소화기 정보를 찾을 수 없습니다"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {fromCache && (
        <p className="bg-muted text-muted-foreground px-4 py-1 text-center text-xs">
          오프라인 캐시된 정보입니다 (마지막 온라인 조회 기준)
        </p>
      )}
      <InspectionChecklist extinguisher={data} />
    </div>
  );
}

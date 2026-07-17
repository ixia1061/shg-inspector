import { Skeleton } from "@/components/ui/skeleton";

/** 관리자 화면 전환 중 즉시 표시되는 로딩 스켈레톤 (전환 버벅거림 체감 완화) */
export default function AdminLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

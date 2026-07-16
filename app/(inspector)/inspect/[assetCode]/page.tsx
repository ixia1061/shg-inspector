"use client";

import { QrCode } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";

import { InspectionChecklist } from "@/components/inspector/InspectionChecklist";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExtinguisherLookup } from "@/hooks/useExtinguisherLookup";
import { createClient } from "@/lib/supabase/client";
import { hasValidScanPass } from "@/lib/utils/scanPass";

type Access = "checking" | "allowed" | "denied";

export default function InspectPage({
  params,
}: {
  params: Promise<{ assetCode: string }>;
}) {
  const { assetCode: rawAssetCode } = use(params);
  // Next.js는 라우트 파라미터를 URL 인코딩된 상태로 전달할 수 있다
  // (한글 관리번호 "공사-1-1-1" → "%EA%B3%B5%EC%82%AC-1-1-1").
  // 인코딩 흔적(%)이 있을 때만 디코딩해 두 동작 모두에 안전하게 대응한다.
  const assetCode = rawAssetCode.includes("%") ? decodeURIComponent(rawAssetCode) : rawAssetCode;
  const { data, loading, error, fromCache } = useExtinguisherLookup(assetCode);

  // 점검자는 QR 스캔을 거쳐야만 점검 화면에 들어올 수 있다. 관리자는 목록에서 바로 가능.
  const [access, setAccess] = useState<Access>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (hasValidScanPass(assetCode)) {
        if (!cancelled) setAccess("allowed");
        return;
      }
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setAccess("denied");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (!cancelled) setAccess(profile?.role === "admin" ? "allowed" : "denied");
      } catch {
        if (!cancelled) setAccess("denied");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [assetCode]);

  if (loading || access === "checking") {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (access === "denied") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
        <QrCode className="text-muted-foreground size-16" />
        <div>
          <p className="font-medium">점검은 QR 스캔으로만 가능합니다</p>
          <p className="text-muted-foreground mt-1 text-sm">
            소화기 앞에서 부착된 QR 코드를 스캔해주세요.
          </p>
        </div>
        <Button size="lg" className="h-14 w-full max-w-xs text-lg" nativeButton={false} render={<Link href="/scan" />}>
          QR 스캔하기
        </Button>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-destructive font-medium">{error ?? "소화기 정보를 찾을 수 없습니다"}</p>
        <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/scan" />}>
          다시 스캔
        </Button>
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { ManualCodeEntry } from "@/components/inspector/ManualCodeEntry";
import { QRScanner } from "@/components/inspector/QRScanner";
import { Button } from "@/components/ui/button";
import { prewarmExtinguisherCache } from "@/lib/offline/prewarm";
import { setScanPass } from "@/lib/utils/scanPass";

function extractAssetCode(decodedText: string): string {
  try {
    const url = new URL(decodedText);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("inspect");
    if (idx !== -1 && parts[idx + 1]) return decodeURIComponent(parts[idx + 1]);
  } catch {
    // URL이 아니면 스캔된 텍스트 자체를 관리번호로 취급한다.
  }
  return decodedText;
}

export default function ScanPage() {
  const router = useRouter();

  // 스캔 대기 중에 미리 준비해 두면 QR 인식 → 점검 화면 전환이 즉시 일어난다:
  // 1) 소화기 정보 전체를 IndexedDB에 사전 적재 (점검 화면이 캐시에서 바로 렌더링)
  // 2) 점검 화면의 JS 번들을 미리 로드
  useEffect(() => {
    void prewarmExtinguisherCache();
    router.prefetch("/inspect/_");
  }, [router]);

  function handleScan(decodedText: string) {
    const assetCode = extractAssetCode(decodedText);
    // 실제 스캔을 거쳤다는 통행증 발급 (점검자는 이게 있어야 점검 화면 진입 가능)
    setScanPass(assetCode);
    router.push(`/inspect/${encodeURIComponent(assetCode)}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <div>
        <h1 className="text-xl font-bold">QR 스캔</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          소화기에 부착된 QR 코드를 카메라에 비춰주세요
        </p>
      </div>
      <QRScanner onScan={handleScan} />

      {/* QR이 손상됐을 때: 관리번호를 직접 입력해 스캔과 동일하게 점검 시작 */}
      <ManualCodeEntry onSubmit={handleScan} />

      <Button
        variant="outline"
        size="lg"
        className="w-full max-w-xs"
        nativeButton={false}
        render={<Link href="/status" />}
      >
        점검 현황 보기
      </Button>
    </div>
  );
}

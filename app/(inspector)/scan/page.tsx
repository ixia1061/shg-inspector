"use client";

import { useRouter } from "next/navigation";

import { QRScanner } from "@/components/inspector/QRScanner";

function extractQrToken(decodedText: string): string {
  try {
    const url = new URL(decodedText);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("inspect");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    // URL이 아니면 스캔된 텍스트 자체를 토큰으로 취급한다.
  }
  return decodedText;
}

export default function ScanPage() {
  const router = useRouter();

  function handleScan(decodedText: string) {
    const token = extractQrToken(decodedText);
    router.push(`/inspect/${token}`);
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
    </div>
  );
}

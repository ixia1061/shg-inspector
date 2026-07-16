"use client";

import { Camera, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const SCANNER_ELEMENT_ID = "qr-scanner-region";
const SCAN_CONFIG = { fps: 10, qrbox: { width: 250, height: 250 } };

type ScannerState = "idle" | "starting" | "running" | "error";

function describeCameraError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);

  if (name === "NotAllowedError" || /permission/i.test(message)) {
    return "카메라 권한이 거부되었습니다. 브라우저 설정에서 이 사이트의 카메라 권한을 허용한 뒤 다시 시도하세요.";
  }
  if (name === "NotFoundError" || /not found|no camera/i.test(message)) {
    return "사용 가능한 카메라를 찾을 수 없습니다. 카메라가 있는 기기(휴대폰)에서 시도하세요.";
  }
  if (name === "NotReadableError") {
    return "다른 앱이 카메라를 사용 중입니다. 다른 앱을 닫고 다시 시도하세요.";
  }
  return `카메라를 시작할 수 없습니다: ${message}`;
}

/**
 * QR 스캐너. iOS Safari 등에서 안정적으로 동작하도록
 * 자동 시작 대신 사용자가 버튼을 눌러(사용자 제스처) 카메라를 시작한다.
 */
export function QRScanner({ onScan }: { onScan: (decodedText: string) => void }) {
  const [state, setState] = useState<ScannerState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);

  function handleDecoded(decodedText: string) {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;
    onScan(decodedText);
  }

  async function startCamera() {
    setState("starting");
    setErrorMessage("");

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = scannerRef.current ?? new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;

      try {
        // 우선 후면 카메라 시도 (휴대폰)
        await scanner.start({ facingMode: "environment" }, SCAN_CONFIG, handleDecoded, undefined);
      } catch (err) {
        // 후면 카메라가 없으면(노트북 등) 아무 카메라로 폴백
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) throw err;
        await scanner.start(cameras[0].id, SCAN_CONFIG, handleDecoded, undefined);
      }

      setState("running");
    } catch (err) {
      console.error("QR scanner start failed:", err);
      setState("error");
      setErrorMessage(describeCameraError(err));
    }
  }

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner && scanner.isScanning) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        id={SCANNER_ELEMENT_ID}
        className="w-full max-w-sm overflow-hidden rounded-lg [&_video]:rounded-lg"
      />

      {state === "idle" && (
        <Button size="lg" className="h-14 w-full max-w-xs text-lg" onClick={startCamera}>
          <Camera className="size-5" /> 카메라 시작
        </Button>
      )}

      {state === "starting" && (
        <Button size="lg" className="h-14 w-full max-w-xs text-lg" disabled>
          카메라 여는 중...
        </Button>
      )}

      {state === "error" && (
        <>
          <p className="text-destructive max-w-sm px-4 text-center text-sm">{errorMessage}</p>
          <Button size="lg" variant="outline" className="h-12 w-full max-w-xs" onClick={startCamera}>
            <RotateCcw className="size-4" /> 다시 시도
          </Button>
        </>
      )}
    </div>
  );
}

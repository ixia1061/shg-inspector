"use client";

import { Camera, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

// 스캔 영역을 뷰파인더의 70%로 크게 잡아, 조금 떨어진 거리에서도 QR이 박스 안에 들어오게 한다.
// (박스가 작으면 QR을 카메라에 바짝 붙여야 해서 초점이 흐려짐)
const SCAN_CONFIG = {
  fps: 15,
  qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
    const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
    return { width: size, height: size };
  },
  aspectRatio: 1.0,
};

// 안드로이드 크롬 등은 네이티브 BarcodeDetector를 지원해 고해상도도 빠르게 처리 → 먼 거리 인식에 유리.
// 아이폰 사파리는 BarcodeDetector 미지원 → JS 디코더로 폴백되는데, 이땐 해상도가 높을수록
// 프레임당 디코딩이 느려지므로 해상도를 낮춰 반응속도를 지킨다.
function hasNativeBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

// 후면 카메라 제약 후보들을 "선호 → 호환" 순으로 만든다.
// iOS 사파리는 focusMode/해상도 같은 제약을 못 받아들이면 그냥 무시하지 않고 시작을 거부(OverconstrainedError)하는
// 경우가 있어, 상위 제약이 실패하면 아래 단계로 자동 폴백해 반드시 카메라가 켜지게 한다.
// (focusMode는 표준 MediaTrackConstraints 타입에 없어 캐스팅한다.)
function buildRearCameraCandidates(): MediaTrackConstraints[] {
  const idealWidth = hasNativeBarcodeDetector() ? 1920 : 1280;
  const idealHeight = Math.round((idealWidth * 9) / 16);
  return [
    // 1) 해상도 + 연속 자동초점 (가장 선호)
    {
      facingMode: "environment",
      width: { ideal: idealWidth },
      height: { ideal: idealHeight },
      advanced: [{ focusMode: "continuous" }],
    } as unknown as MediaTrackConstraints,
    // 2) 해상도만 (focusMode 제약에서 거부되는 기기 대비)
    {
      facingMode: "environment",
      width: { ideal: idealWidth },
      height: { ideal: idealHeight },
    },
    // 3) 최소 제약 (호환성 최우선 — 예전에 동작하던 방식)
    { facingMode: "environment" },
  ];
}

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
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner =
        scannerRef.current ??
        new Html5Qrcode(SCANNER_ELEMENT_ID, {
          // 네이티브 BarcodeDetector(안드로이드 크롬 등 지원 기기)를 쓰면 인식이 훨씬 빠르다.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          // QR만 디코딩해 불필요한 바코드 포맷 탐색을 없앤다(속도 향상).
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      scannerRef.current = scanner;

      // 후면 카메라 제약을 상위 → 하위로 시도하고, 모두 실패하면 사용 가능한 아무 카메라로 폴백.
      let started = false;
      let lastErr: unknown;
      for (const constraints of buildRearCameraCandidates()) {
        try {
          await scanner.start(constraints, SCAN_CONFIG, handleDecoded, undefined);
          started = true;
          break;
        } catch (err) {
          lastErr = err;
          // 권한 거부는 재시도해도 소용없으므로 즉시 중단
          if (err instanceof Error && err.name === "NotAllowedError") throw err;
        }
      }

      if (!started) {
        // 후면 카메라 제약이 모두 실패(노트북 등 후면 없음) → 아무 카메라로 폴백
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras.length) throw lastErr ?? new Error("사용 가능한 카메라 없음");
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

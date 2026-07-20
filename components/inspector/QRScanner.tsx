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
    const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8);
    return { width: size, height: size };
  },
  aspectRatio: 1.0,
};

// 아이폰 사파리는 네이티브 BarcodeDetector가 없어 html5-qrcode가 느린 JS 디코더로 폴백한다.
// ZXing-C++(WASM) 기반 폴리필을 window.BarcodeDetector로 주입하면 인식 속도·거리(작은/원거리 QR)가
// 크게 개선된다. WASM은 앱에 포함(public/zxing_reader.wasm)해 CDN 의존 없이 동작한다.
// 안전장치: WASM이 실제로 로드된 경우에만 폴리필을 설치한다. 실패(오프라인/로드오류) 시 조용히
// 기존 JS 디코더로 폴백하므로 스캐너가 깨지지 않는다. 여러 번 호출돼도 1회만 로드(싱글턴).
let barcodeDetectorReadyPromise: Promise<void> | null = null;
function ensureFastBarcodeDetector(): Promise<void> {
  if (barcodeDetectorReadyPromise) return barcodeDetectorReadyPromise;
  barcodeDetectorReadyPromise = (async () => {
    if (typeof window === "undefined") return;
    if ("BarcodeDetector" in window) return; // 네이티브 존재(안드로이드 등) → 그대로 사용
    try {
      const { BarcodeDetector, setZXingModuleOverrides } = await import(
        "barcode-detector/ponyfill"
      );
      // 번들에 포함한 로컬 WASM을 쓰도록 경로 지정(CDN 미사용).
      setZXingModuleOverrides({
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path,
      });
      // 워밍업: 빈 캔버스로 detect를 한 번 돌려 WASM 로드를 확인한다(바코드 없으면 빈 배열 반환).
      const warmup = new BarcodeDetector({ formats: ["qr_code"] });
      const canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      await warmup.detect(canvas);
      // 여기까지 왔으면 WASM 정상 → 전역에 설치(html5-qrcode가 이 디코더를 사용).
      (window as unknown as { BarcodeDetector: typeof BarcodeDetector }).BarcodeDetector =
        BarcodeDetector;
    } catch {
      // WASM 로드 실패 — 폴리필 미설치, 기본 JS 디코더 유지
    }
  })();
  return barcodeDetectorReadyPromise;
}

// 안드로이드 크롬 등은 네이티브 BarcodeDetector를 지원해 고해상도도 빠르게 처리 → 먼 거리 인식에 유리.
// 아이폰 사파리는 BarcodeDetector 미지원 → JS 디코더로 폴백되는데, 이땐 해상도가 높을수록
// 프레임당 디코딩이 느려지므로 해상도를 낮춰 반응속도를 지킨다.
function hasNativeBarcodeDetector(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

// 카메라 상세 제약. html5-qrcode의 start() 첫 인자는 키가 정확히 1개인 객체(예: {facingMode})만
// 허용하므로, 해상도 등 상세 제약은 config.videoConstraints로 넘긴다(라이브러리가 이 경우 1-key 검증을 건너뜀).
// facingMode/해상도는 모두 ideal(선호)이라 지원 안 하면 무시될 뿐 start()가 거부되지 않는다.
// 연속 자동초점은 거부 위험을 피하려 여기 넣지 않고 카메라가 켜진 뒤 별도로 적용한다.
function buildVideoConstraints(): MediaTrackConstraints {
  const idealWidth = hasNativeBarcodeDetector() ? 1920 : 1280;
  return {
    facingMode: "environment",
    width: { ideal: idealWidth },
    height: { ideal: Math.round((idealWidth * 9) / 16) },
  };
}

// 카메라가 켜진 뒤 연속 자동초점을 best-effort로 적용한다(가까이 대도 초점이 흐려지지 않게).
// 지원하지 않는 기기(대부분의 iOS 등)에서는 조용히 무시하고 기본 자동초점에 맡긴다.
async function applyContinuousFocus() {
  try {
    const video = document.getElementById(SCANNER_ELEMENT_ID)?.querySelector("video");
    const stream = video?.srcObject;
    if (!(stream instanceof MediaStream)) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    await track.applyConstraints({
      advanced: [{ focusMode: "continuous" }],
    } as unknown as MediaTrackConstraints);
  } catch {
    // 초점 제약 미지원 — 무시
  }
}

type ScannerState = "idle" | "starting" | "running" | "error";

/**
 * 카메라를 아예 쓸 수 없는 환경인지 미리 확인한다(제약 문제가 아니라 브라우저/연결 문제).
 * iOS에서 가장 흔한 실패 원인: 카카오톡·인스타 등 "앱 안의 브라우저"는 카메라 API를 막는다.
 * 문제 없으면 null.
 */
function cameraUnavailableReason(): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;

  if (!window.isSecureContext) {
    return "보안 연결(HTTPS)이 아니어서 카메라를 쓸 수 없습니다. 주소가 https:// 로 시작하는지 확인하세요.";
  }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return "이 브라우저에서는 카메라를 쓸 수 없습니다. 카카오톡·인스타그램·네이버 등 '앱 안의 브라우저'로 열었다면, 우측 상단 메뉴에서 사파리(또는 크롬)로 연 뒤 다시 시도하세요.";
  }
  return null;
}

function describeCameraError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);

  if (name === "NotAllowedError" || /permission/i.test(message)) {
    return "카메라 권한이 거부되었습니다. 아이폰: 설정 > 사파리 > 카메라를 '허용'으로, 또는 주소창 왼쪽 'ㄱ가' 메뉴 > 웹사이트 설정에서 카메라를 허용한 뒤 다시 시도하세요.";
  }
  if (name === "NotFoundError" || /not found|no camera/i.test(message)) {
    return "사용 가능한 카메라를 찾을 수 없습니다. 카메라가 있는 기기(휴대폰)에서 시도하세요.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "다른 앱이 카메라를 사용 중입니다. 카메라를 쓰는 다른 앱을 완전히 닫고 다시 시도하세요.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "이 기기의 카메라가 요청한 설정을 지원하지 않습니다. 브라우저를 최신으로 업데이트한 뒤 다시 시도하세요.";
  }
  // 원인 분류가 안 되면 오류 이름을 함께 노출해 진단할 수 있게 한다.
  return `카메라를 시작할 수 없습니다${name ? ` (${name})` : ""}: ${message}`;
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

    // 카메라 API 자체가 없는 환경(인앱 브라우저/비보안 연결)은 먼저 안내하고 중단.
    const envReason = cameraUnavailableReason();
    if (envReason) {
      setState("error");
      setErrorMessage(envReason);
      return;
    }

    // 고속 WASM 디코더 준비를 기다린다(마운트 시 미리 시작해 두므로 보통 즉시 통과).
    await ensureFastBarcodeDetector();

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

      // 상세 제약(해상도)은 config.videoConstraints로 전달한다. 첫 인자는 1-key 객체여야 하며
      // videoConstraints가 있으면 이 값이 실제 getUserMedia 제약으로 쓰인다.
      const config = { ...SCAN_CONFIG, videoConstraints: buildVideoConstraints() };
      await scanner.start({ facingMode: "environment" }, config, handleDecoded, undefined);

      setState("running");
      // 카메라가 켜진 뒤 연속 자동초점 적용(지원 기기에서만, 실패해도 무시).
      void applyContinuousFocus();
    } catch (err) {
      console.error("QR scanner start failed:", err);
      // start() 실패 시 인스턴스가 "전환 중" 상태에 갇힐 수 있어, 다음 "다시 시도"가 같은 오류로 막힌다.
      // → 인스턴스를 버려 재시도 때 새로 만들게 한다.
      scannerRef.current = null;
      setState("error");
      setErrorMessage(describeCameraError(err));
    }
  }

  useEffect(() => {
    // 화면 진입 시 고속 디코더를 미리 준비(사용자가 '카메라 시작'을 누를 때쯤 로드 완료).
    void ensureFastBarcodeDetector();

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
        className="w-full max-w-md overflow-hidden rounded-lg [&_video]:rounded-lg"
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

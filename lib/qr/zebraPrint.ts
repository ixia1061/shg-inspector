/**
 * Zebra Browser Print 연동.
 * 관리자 PC에 Zebra의 "Browser Print" 유틸리티가 설치되어 있어야 하고,
 * 해당 유틸리티가 로드하는 전역 객체 window.BrowserPrint를 사용한다.
 * (Zebra 공식 사이트에서 내려받은 BrowserPrint SDK 스크립트를 프린트 페이지에 추가해야 동작한다.)
 */

interface ZebraDevice {
  send: (data: string, success?: () => void, error?: (msg: string) => void) => void;
}

interface BrowserPrintApi {
  getDefaultDevice: (
    type: string,
    success: (device: ZebraDevice) => void,
    error: (msg: string) => void
  ) => void;
}

declare global {
  interface Window {
    BrowserPrint?: BrowserPrintApi;
  }
}

export function isZebraBrowserPrintAvailable(): boolean {
  return typeof window !== "undefined" && !!window.BrowserPrint;
}

export function printZpl(zpl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.BrowserPrint) {
      reject(
        new Error(
          "Zebra BrowserPrint 유틸리티를 찾을 수 없습니다. 관리자 PC에 설치되어 있는지 확인하세요."
        )
      );
      return;
    }

    window.BrowserPrint.getDefaultDevice(
      "printer",
      (device) => {
        device.send(
          zpl,
          () => resolve(),
          (err) => reject(new Error(err))
        );
      },
      (err) => reject(new Error(err))
    );
  });
}

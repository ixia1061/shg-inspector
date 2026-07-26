"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * 서비스워커 등록 + 배포된 새 버전 감지·안내.
 *
 * 배포 후에도 이미 열려 있는 탭은 옛 SW/청크로 계속 돌아 화면이 안 바뀐다.
 * 그래서 새 SW가 설치되면 곧바로 활성화하지 않고(대기), 사용자에게 "새로고침"을
 * 안내한다. 눌러야만 새 SW를 활성화(SKIP_WAITING)하고 페이지를 다시 불러온다.
 * (전체 리로드라 Next.js 라우터 캐시·SW 캐시가 함께 갱신된다.)
 *
 * 강제 리로드를 하지 않는 이유: 현장에서 점검 체크리스트를 입력하는 도중
 * 예고 없이 새로고침되면 작성 중이던 내용이 사라질 수 있어서다.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    // 사용자가 "새로고침"을 눌러 업데이트를 시작한 경우에만 리로드한다.
    // (첫 방문 설치 때 clientsClaim으로 발생하는 controllerchange로는 리로드하지 않음)
    let userTriggeredUpdate = false;
    let reloading = false;

    const onControllerChange = () => {
      if (!userTriggeredUpdate || reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const promptUpdate = (waiting: ServiceWorker) => {
      toast("새 버전이 있습니다", {
        id: "sw-update", // 중복 안내 방지
        description: "새로고침하면 최신 화면으로 업데이트됩니다.",
        duration: Infinity, // 사용자가 처리할 때까지 유지
        action: {
          label: "새로고침",
          onClick: () => {
            userTriggeredUpdate = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;

        // 다른 탭 등에서 이미 새 SW가 대기 중이면 바로 안내
        if (reg.waiting && navigator.serviceWorker.controller) {
          promptUpdate(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // 새 SW 설치 완료 + 기존 컨트롤러 존재 = "업데이트 대기" 상태
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(installing);
            }
          });
        });
      })
      .catch(() => {
        // 등록 실패는 조용히 무시 — 오프라인 캐싱만 못 쓸 뿐 앱 자체는 정상 동작한다.
      });

    // 앱을 오래 열어둔 경우, 탭이 다시 보일 때 새 배포가 있는지 확인한다.
    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

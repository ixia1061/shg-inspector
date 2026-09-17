"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
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
 *
 * 단, **로그인 화면**은 대부분 입력 중인 데이터가 없는 안전한 시점이므로 안내
 * 없이 바로 적용한다 — 오랜만에 재접속했을 때 대기 중이던 업데이트를 놓치지
 * 않으면서도, 로그인 후 앱을 쓰는 도중에는 예전처럼 안내 후 사용자가
 * 새로고침을 눌러야만 적용된다. 단, 이메일·비밀번호를 입력하던 도중이면
 * 그 값이 사라지므로 이 경우엔 예외로 기존 안내 방식(토스트)으로 되돌아간다.
 */
const LOGIN_PATHNAME = "/login";

/** 로그인 폼에 입력 중인 값이 있는지 — 있으면 즉시 리로드하지 않는다. */
function hasUnsavedLoginInput(): boolean {
  const email = document.getElementById("email") as HTMLInputElement | null;
  const password = document.getElementById("password") as HTMLInputElement | null;
  return !!(email?.value || password?.value);
}

// 이 탭에서 안내를 닫았는지 기록 — 탭/세션을 새로 열면 초기화된다(sessionStorage).
const DISMISS_KEY = "sw-update-dismissed";

function hasDismissedUpdatePrompt(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markUpdatePromptDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // 프라이빗 모드 등으로 저장 실패해도 앱 동작에는 영향 없음
  }
}

/**
 * 이전에 닫은 안내를 초기화한다. `updatefound`는 브라우저가 현재 설치/대기 중인
 * 서비스워커와 바이트가 다른 새 버전을 감지했을 때만 발생하므로, 이 시점은
 * 항상 "이전에 닫았던 것과는 다른, 진짜 새 배포"다 — dismiss 플래그가 버전을
 * 구분하지 않고 그대로 남아있으면 이 새 배포까지 조용히 묻혀버리므로 초기화한다.
 */
function clearDismissedUpdatePrompt(): void {
  try {
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    // 무시
  }
}

export function ServiceWorkerRegister() {
  const pathname = usePathname();
  // 루트 레이아웃은 라우트가 바뀌어도 재마운트되지 않아 effect가 한 번만 도니,
  // promptUpdate 시점의 최신 경로를 읽기 위해 ref로 동기화해 둔다.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

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
      // 로그인 화면 = 입력 중인 데이터가 없는 안전한 시점 → 묻지 않고 바로 적용.
      // (단, 입력 중이던 이메일·비밀번호가 있으면 예외 — 아래로 내려가 토스트 안내)
      if (pathnameRef.current === LOGIN_PATHNAME && !hasUnsavedLoginInput()) {
        userTriggeredUpdate = true;
        waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      if (hasDismissedUpdatePrompt()) return;

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
        cancel: {
          label: "나중에",
          onClick: () => {
            markUpdatePromptDismissed();
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
              // updatefound는 지금 대기 중인 것과 바이트가 다른 새 버전을 감지했을
              // 때만 발생 — 즉 이전에 닫았던 업데이트와는 무조건 다른 새 배포이므로,
              // 예전 dismiss 플래그가 이번 안내까지 가리지 않도록 먼저 초기화한다.
              clearDismissedUpdatePrompt();
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

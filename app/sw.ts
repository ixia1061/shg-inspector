import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * 관리대장(.xlsx) 다운로드는 매번 최신 DB 상태를 반영해 그때그때 생성되는
 * 보고서라 캐시하면 안 된다. 그런데 `defaultCache`의 `/api/*` 규칙(NetworkFirst,
 * networkTimeoutSeconds: 10)이 이 요청도 가로채서, 관리자 페이지 데이터가 많아
 * 응답이 10초를 넘기면(콜드스타트 등) **예전에 받았던 파일을 그대로 되돌려주는**
 * 문제가 있었다 — 배포는 반영됐는데 실제로 받아보면 옛 내용 그대로인 것처럼 보임.
 * 이 경로만 기본 규칙보다 먼저 매칭시켜 캐시를 거치지 않고 항상 네트워크로만 간다.
 */
const noCacheDownloads: RuntimeCaching = {
  matcher: ({ sameOrigin, url: { pathname } }) => sameOrigin && pathname === "/api/ledger/download",
  handler: new NetworkOnly(),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // 새 버전을 곧바로 활성화하면 이미 열려 있는 탭이 옛 코드/캐시로 계속 돌아
  // 배포 후에도 화면이 안 바뀌는 문제가 생긴다. 새 SW는 대기(waiting) 상태로 두고,
  // 클라이언트(ServiceWorkerRegister)에서 "새로고침" 안내 후 SKIP_WAITING 메시지를
  // 보낼 때만 활성화한다. (serwist 코어가 이 메시지를 받아 self.skipWaiting() 호출)
  skipWaiting: false,
  // 활성화되면 즉시 열려 있는 탭을 제어 → controllerchange가 발생해 클라이언트가 리로드한다.
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [noCacheDownloads, ...defaultCache],
});

serwist.addEventListeners();

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

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
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

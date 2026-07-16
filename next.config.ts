import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

// Serwist는 아직 Turbopack을 지원하지 않고, withSerwist가 주입하는 webpack 설정이
// `next dev`(Turbopack 기본값)와 충돌한다. 개발 모드에서는 Serwist 래핑 자체를 건너뛴다.
// 프로덕션 빌드(`next build --webpack`)에서만 서비스워커를 번들링한다.
export default process.env.NODE_ENV === "production" ? withSerwist(nextConfig) : nextConfig;

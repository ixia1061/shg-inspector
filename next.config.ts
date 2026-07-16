import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  // 같은 네트워크의 휴대폰 등 다른 기기에서 dev 서버로 접속하는 것을 허용.
  // (Next.js 16은 기본적으로 크로스 오리진 dev 리소스 요청을 차단해 JS가 로드되지 않는다)
  // PC의 IP가 바뀌면 여기에 새 IP를 추가해야 한다. *.trycloudflare.com은 휴대폰 테스트용 터널.
  allowedDevOrigins: ["192.168.0.81", "localhost", "*.trycloudflare.com"],
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

// Serwist는 아직 Turbopack을 지원하지 않고, withSerwist가 주입하는 webpack 설정이
// `next dev`(Turbopack 기본값)와 충돌한다. 개발 모드에서는 Serwist 래핑 자체를 건너뛴다.
// 프로덕션 빌드(`next build --webpack`)에서만 서비스워커를 번들링한다.
export default process.env.NODE_ENV === "production" ? withSerwist(nextConfig) : nextConfig;

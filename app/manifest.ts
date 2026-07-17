import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "소화기 점검 관리 시스템",
    short_name: "소화기점검",
    description: "QR 스캔으로 소화기 점검을 빠르게 기록하고, 점검 현황과 내용연수를 관리합니다.",
    // 루트에서 역할별 홈으로 라우팅한다(관리자→대시보드, 점검자→스캔).
    // "/scan"으로 두면 관리자가 앱 실행 시 점검자 화면으로 진입한다.
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#dc2626",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

// 로그인 전에도 볼 수 있는 경로. 도움말은 로그인이 막힌 사용자도 읽을 수 있어야 하므로 공개.
const PUBLIC_PATHS = ["/login", "/help"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // 인증을 확인할 수 없을 때(환경변수 누락, Supabase 초기화/조회 실패)의 안전한 폴백.
  // 전체 사이트가 500으로 죽지 않도록, 공개 경로는 통과시키고 보호 경로는 로그인으로 보낸다.
  const redirectToLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // NEXT_PUBLIC_* 값은 빌드 시점에 번들에 박힌다. 빌드 때 값이 없으면 여기서 undefined가 되는데,
  // createServerClient(undefined, undefined)는 예외를 던져 미들웨어 전체가 500이 된다 → 미리 방어.
  if (!supabaseUrl || !supabaseAnonKey) {
    return isPublicPath ? response : redirectToLogin();
  }

  try {
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // 성능: 미들웨어는 화면 이동(프리페치 포함)마다 실행된다. getUser()는 매번 Supabase
    // 인증 서버로 네트워크 왕복(리전이 뭄바이라 지연 큼)을 하므로 이동이 버벅인다.
    // 여기서는 "로그인 여부"에 따른 리다이렉트 판단만 필요하므로, 쿠키를 로컬에서 읽고
    // 만료 시에만 갱신하는 getSession()을 쓴다. (토큰 만료 시 setAll로 쿠키가 자동 갱신됨)
    // 실제 인증·권한의 최종 검증은 각 레이아웃의 getUser() + RLS가 담당하므로 안전하다.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user && !isPublicPath) {
      return redirectToLogin();
    }

    if (user && path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/scan";
      return NextResponse.redirect(url);
    }

    return response;
  } catch {
    // 세션 검증 중 예외(네트워크 오류 등)가 나도 500 대신 안전하게 처리한다.
    return isPublicPath ? response : redirectToLogin();
  }
}

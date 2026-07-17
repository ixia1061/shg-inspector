import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

const PUBLIC_PATHS = ["/login"];

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

    // getUser()는 매 요청마다 토큰을 검증한다 (getSession()은 검증 없이 쿠키만 읽으므로 사용하지 않는다).
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

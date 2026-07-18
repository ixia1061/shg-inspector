import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";

export default async function RootPage() {
  const supabase = await createClient();
  // 성능: 인증서버 왕복(getUser) 대신 쿠키 로컬 읽기(getSession). 미들웨어가 세션을 검증하고
  // RLS가 데이터를 보호하므로 보안 동일. 재실행 시 흰 화면(왕복 지연)을 줄인다.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  redirect(isAdminRole(profile?.role) ? "/dashboard" : "/scan");
}

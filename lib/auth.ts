import { createClient } from "@/lib/supabase/server";

/** 현재 로그인한 사용자의 역할(super_admin/admin/inspector)을 반환한다. 서버 컴포넌트/액션용. */
export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return data?.role ?? null;
}

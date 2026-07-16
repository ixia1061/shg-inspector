import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * SERVICE_ROLE 키를 사용하는 관리자 전용 클라이언트.
 * RLS를 우회하므로 Server Action / Route Handler에서만 사용하고,
 * 절대 클라이언트 컴포넌트나 브라우저로 전달하지 않는다.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

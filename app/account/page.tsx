import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/shared/ChangePasswordForm";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { SiteOrderEditor } from "@/components/shared/SiteOrderEditor";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";
import { sortSitesByPreference } from "@/lib/utils/sort";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .single();

  const isAdmin = isAdminRole(profile?.role);
  const homeHref = isAdmin ? "/dashboard" : "/scan";

  // 관리자만 점검현황·수량현황 사업장 버튼 순서를 개인적으로 설정할 수 있다.
  const [{ data: sites }, { data: orderRow }] = isAdmin
    ? await Promise.all([
        supabase.from("sites").select("id, name").order("name"),
        supabase.from("user_site_order").select("site_order").eq("user_id", user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const orderedSites = isAdmin ? sortSitesByPreference(sites ?? [], orderRow?.site_order) : [];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <Link href={homeHref} className="text-muted-foreground flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> 뒤로
        </Link>
        <SignOutButton />
      </div>

      <div>
        <h1 className="text-xl font-bold">내 계정</h1>
        <p className="text-muted-foreground text-sm">
          {profile?.name ?? "이름 없음"} · {user.email}
        </p>
      </div>

      <ChangePasswordForm />

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-sm font-semibold">사업장 표시 순서</h2>
            <p className="text-muted-foreground text-xs">
              점검현황·수량현황 상단 사업장 버튼이 이 순서로 나타납니다. 나에게만 적용됩니다.
            </p>
          </div>
          <SiteOrderEditor sites={orderedSites} />
        </div>
      )}
    </div>
  );
}

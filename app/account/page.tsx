import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/shared/ChangePasswordForm";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";

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

  const homeHref = isAdminRole(profile?.role) ? "/dashboard" : "/scan";

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
    </div>
  );
}

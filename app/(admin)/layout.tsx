import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!isAdminRole(profile?.role)) {
    redirect("/scan");
  }

  const role = profile?.role ?? "admin";

  return (
    <div className="flex min-h-screen">
      <AdminSidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <AdminMobileNav role={role} />
            <Link href="/account" className="text-sm font-medium hover:underline">
              {profile?.name}님
            </Link>
          </div>
          <SignOutButton />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

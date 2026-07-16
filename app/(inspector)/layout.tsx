import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/shared/SignOutButton";
import { SyncStatusBanner } from "@/components/inspector/SyncStatusBanner";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorLayout({
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="text-base font-bold">소화기 점검</span>
        <SignOutButton />
      </header>
      <SyncStatusBanner />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

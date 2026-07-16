import { ClipboardList, QrCode, UserRound } from "lucide-react";
import Link from "next/link";
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
        <div className="flex items-center gap-1">
          <Link
            href="/scan"
            className="text-muted-foreground flex items-center gap-1 p-2 text-sm"
            aria-label="QR 스캔"
          >
            <QrCode className="size-5" />
            스캔
          </Link>
          <Link
            href="/status"
            className="text-muted-foreground flex items-center gap-1 p-2 text-sm"
            aria-label="점검 현황"
          >
            <ClipboardList className="size-5" />
            현황
          </Link>
          <Link href="/account" className="text-muted-foreground p-2" aria-label="내 계정">
            <UserRound className="size-5" />
          </Link>
          <SignOutButton />
        </div>
      </header>
      <SyncStatusBanner />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

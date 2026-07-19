import { ClipboardList, HelpCircle, QrCode, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/shared/SignOutButton";
import { SyncStatusBanner } from "@/components/inspector/SyncStatusBanner";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";

export default async function InspectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // 성능: getUser(인증서버 왕복) 대신 getSession(쿠키 로컬). 미들웨어 세션 검증 + RLS로 보안 유지.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    redirect("/login");
  }

  // 관리자가 (PWA 화면 복원 등으로) 점검자 화면에 들어오면 관리 대시보드로 보낸다.
  // 관리자는 점검자 스캔 흐름 대신 관리 영역의 점검 모달을 쓰므로, 여기 갇히지 않게 한다.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (isAdminRole(profile?.role)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <span className="text-base font-bold">소화기 점검</span>
        <nav className="flex items-center gap-0.5">
          <Link
            href="/scan"
            aria-label="QR 스캔"
            className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-9 items-center justify-center rounded-md"
          >
            <QrCode className="size-5" />
          </Link>
          <Link
            href="/status"
            aria-label="점검 현황"
            className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-9 items-center justify-center rounded-md"
          >
            <ClipboardList className="size-5" />
          </Link>
          <Link
            href="/help"
            aria-label="도움말"
            className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-9 items-center justify-center rounded-md"
          >
            <HelpCircle className="size-5" />
          </Link>
          <Link
            href="/account"
            aria-label="내 계정"
            className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-9 items-center justify-center rounded-md"
          >
            <UserRound className="size-5" />
          </Link>
          <SignOutButton iconOnly />
        </nav>
      </header>
      <SyncStatusBanner />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

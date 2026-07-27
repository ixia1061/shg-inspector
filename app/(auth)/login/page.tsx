import Link from "next/link";

import { LoginForm } from "@/components/shared/LoginForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { APP_VERSION } from "@/lib/version";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">소화기 점검 관리 시스템</h1>
        <p className="text-muted-foreground text-sm">
          발급받은 계정으로 로그인하세요
        </p>
      </div>

      {status === "pending" && (
        <Alert className="w-full max-w-sm">
          <AlertTitle>가입 승인 대기 중입니다</AlertTitle>
          <AlertDescription>
            사업장 관리자가 승인하면 이용할 수 있습니다. 승인 여부는 관리자에게 문의하세요.
          </AlertDescription>
        </Alert>
      )}

      <LoginForm />
      <Link href="/signup" className="text-muted-foreground text-sm underline underline-offset-4">
        점검자이신가요? 가입 신청
      </Link>
      <p className="text-muted-foreground text-xs">Ver {APP_VERSION}</p>
    </div>
  );
}

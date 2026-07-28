import Link from "next/link";

import { SignupForm } from "@/components/shared/SignupForm";
import { APP_VERSION } from "@/lib/version";

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">소화기 점검 관리 시스템</h1>
        <p className="text-muted-foreground text-sm">
          관리자에게 받은 가입코드로 점검자 계정을 신청하세요
        </p>
      </div>
      <SignupForm />
      <Link href="/login" className="text-muted-foreground text-sm underline underline-offset-4">
        이미 계정이 있으신가요? 로그인
      </Link>
      <p className="text-muted-foreground text-xs">Ver {APP_VERSION}</p>
    </div>
  );
}

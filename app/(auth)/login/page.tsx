import { LoginForm } from "@/components/shared/LoginForm";
import { APP_VERSION } from "@/lib/version";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">소화기 점검 관리 시스템</h1>
        <p className="text-muted-foreground text-sm">
          발급받은 계정으로 로그인하세요
        </p>
      </div>
      <LoginForm />
      <p className="text-muted-foreground text-xs">Ver {APP_VERSION}</p>
    </div>
  );
}

"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** iconOnly=true면 아이콘만(모바일 헤더 정렬용), 아니면 아이콘+글자. */
export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="로그아웃"
        className="text-muted-foreground"
        onClick={handleSignOut}
        disabled={loading}
      >
        <LogOut className="size-5" />
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={loading}>
      <LogOut className="size-4" />
      로그아웃
    </Button>
  );
}

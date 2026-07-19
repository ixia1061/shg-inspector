"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/** 이전 화면으로 돌아가는 버튼. */
export function BackButton({ label = "뒤로" }: { label?: string }) {
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" onClick={() => router.back()}>
      <ArrowLeft className="size-4" /> {label}
    </Button>
  );
}

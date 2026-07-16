"use client";

import {
  Boxes,
  Building2,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  QrCode,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/sites", label: "사업장/건물 관리", icon: Building2 },
  { href: "/extinguishers", label: "소화기 관리", icon: QrCode },
  { href: "/inventory", label: "수량 현황", icon: Boxes },
  { href: "/inspections", label: "점검현황", icon: ClipboardList },
  { href: "/lifecycle", label: "내용연수 관리", icon: ShieldAlert },
  { href: "/stats", label: "통계", icon: Gauge },
  { href: "/users", label: "사용자 관리", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r bg-sidebar p-3">
      <div className="mb-4 px-2">
        <p className="text-sm font-semibold">소화기 점검 관리</p>
        <p className="text-muted-foreground text-xs">관리자</p>
      </div>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto px-2 pt-4">
        <Link href="/extinguishers" className="text-muted-foreground flex items-center gap-2 text-xs">
          <Search className="size-3" /> 소화기 검색은 소화기 관리에서
        </Link>
      </div>
    </nav>
  );
}

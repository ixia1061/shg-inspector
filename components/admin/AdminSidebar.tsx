"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { navItemsForRole } from "./adminNav";
import { ROLE_LABELS } from "@/lib/utils/roles";
import { APP_VERSION } from "@/lib/version";

/** 데스크톱(lg 이상) 전용 고정 사이드바. 모바일에서는 숨기고 AdminMobileNav(햄버거)가 대신한다. */
export function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <nav className="hidden h-full w-56 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 lg:flex">
      <div className="mb-4 px-2">
        <p className="text-sm font-semibold">소화기 점검 관리</p>
        <p className="text-muted-foreground text-xs">
          {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? "관리자"}
        </p>
      </div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            prefetch
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
      <p className="text-muted-foreground mt-auto px-2 pt-3 text-xs">버전 {APP_VERSION}</p>
    </nav>
  );
}

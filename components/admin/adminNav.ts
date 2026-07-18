import {
  Boxes,
  Building2,
  ClipboardList,
  Gauge,
  Images,
  LayoutDashboard,
  Printer,
  QrCode,
  ShieldAlert,
  Users,
} from "lucide-react";

/** 데스크톱 사이드바와 모바일 드로어가 공유하는 관리자 네비게이션 항목 */
export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** 시스템관리자에게만 보이는 항목 */
  superAdminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/sites", label: "사업장/건물 관리", icon: Building2 },
  { href: "/extinguishers", label: "소화기 관리", icon: QrCode },
  { href: "/inventory", label: "수량 현황", icon: Boxes },
  { href: "/inspections", label: "점검현황", icon: ClipboardList },
  { href: "/lifecycle", label: "내용연수 관리", icon: ShieldAlert },
  { href: "/photos", label: "사진 관리", icon: Images },
  { href: "/stats", label: "통계", icon: Gauge },
  { href: "/labels", label: "QR Code 관리", icon: Printer },
  { href: "/users", label: "사용자 관리", icon: Users, superAdminOnly: true },
];

/** 역할에 따라 볼 수 있는 네비게이션 항목만 남긴다. */
export function navItemsForRole(role: string | null | undefined): NavItem[] {
  const isSuper = role === "super_admin";
  return NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuper);
}

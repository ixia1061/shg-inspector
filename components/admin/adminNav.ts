import {
  Boxes,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  HelpCircle,
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
  // 지난 달 대장은 점검현황과 분리해 여기서만 다룬다(진행 중인 달과 섞이지 않게).
  { href: "/ledgers", label: "관리대장", icon: FileSpreadsheet },
  { href: "/lifecycle", label: "내용연수 관리", icon: ShieldAlert },
  { href: "/photos", label: "사진 관리", icon: Images },
  { href: "/stats", label: "통계", icon: Gauge },
  { href: "/labels", label: "QR Code 관리", icon: Printer },
  // 점검자 계정 관리(생성·가입승인·점검범위·활성)를 한 화면에 모았다.
  // 예전에는 점검 범위만 /assignments에서 따로 체크했는데, 같은 일을 두 화면에서 하게 돼 통합.
  { href: "/users", label: "사용자 관리", icon: Users },
  { href: "/help", label: "도움말", icon: HelpCircle },
];

/** 역할에 따라 볼 수 있는 네비게이션 항목만 남긴다. */
export function navItemsForRole(role: string | null | undefined): NavItem[] {
  const isSuper = role === "super_admin";
  return NAV_ITEMS.filter((item) => !item.superAdminOnly || isSuper);
}

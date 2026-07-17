import {
  Boxes,
  Building2,
  ClipboardList,
  Gauge,
  Images,
  LayoutDashboard,
  QrCode,
  ShieldAlert,
  Users,
} from "lucide-react";

/** 데스크톱 사이드바와 모바일 드로어가 공유하는 관리자 네비게이션 항목 */
export const NAV_ITEMS: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/sites", label: "사업장/건물 관리", icon: Building2 },
  { href: "/extinguishers", label: "소화기 관리", icon: QrCode },
  { href: "/inventory", label: "수량 현황", icon: Boxes },
  { href: "/inspections", label: "점검현황", icon: ClipboardList },
  { href: "/lifecycle", label: "내용연수 관리", icon: ShieldAlert },
  { href: "/photos", label: "사진 관리", icon: Images },
  { href: "/stats", label: "통계", icon: Gauge },
  { href: "/users", label: "사용자 관리", icon: Users },
];

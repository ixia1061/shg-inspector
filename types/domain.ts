import type { Database } from "@/types/database.types";

export type {
  LifecycleStatus,
  UserRole,
  ExtinguisherStatus,
  InspectionResult,
  LocationType,
} from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Site = Database["public"]["Tables"]["sites"]["Row"];
export type Building = Database["public"]["Tables"]["buildings"]["Row"];
export type Floor = Database["public"]["Tables"]["floors"]["Row"];
export type Zone = Database["public"]["Tables"]["zones"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type ExtinguisherType = Database["public"]["Tables"]["extinguisher_types"]["Row"];
export type Extinguisher = Database["public"]["Tables"]["extinguishers"]["Row"];
export type AssetCodeHistoryEntry = Database["public"]["Tables"]["asset_code_history"]["Row"];
export type Inspection = Database["public"]["Tables"]["inspections"]["Row"];
export type InspectionPhoto = Database["public"]["Tables"]["inspection_photos"]["Row"];
export type ExtinguisherOverview = Database["public"]["Views"]["v_extinguisher_overview"]["Row"];
/** 목록/QR/수량 페이지용 경량 뷰 Row (점검 여부 계산 제외). */
export type ExtinguisherListItem = Database["public"]["Views"]["v_extinguisher_list"]["Row"];
export type DashboardSummary = Database["public"]["Functions"]["fn_dashboard_summary"]["Returns"][number];
export type InspectionRateRow = Database["public"]["Functions"]["fn_inspection_rate"]["Returns"][number];

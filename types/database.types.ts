/**
 * 손으로 작성한 임시 타입 정의.
 * Supabase 프로젝트 연결 후에는 아래 명령으로 자동 생성된 타입으로 교체할 것:
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > types/database.types.ts
 */

export type LifecycleStatus = "normal" | "due_90" | "due_30" | "expired";
export type UserRole = "admin" | "inspector";
export type ExtinguisherStatus = "active" | "replaced" | "disposed";
export type InspectionResult = "normal" | "abnormal";
export type LocationType = "BUILDING" | "VEHICLE";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          phone?: string | null;
          role?: UserRole;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      user_sites: {
        Row: { user_id: string; site_id: string };
        Insert: { user_id: string; site_id: string };
        Update: Partial<{ user_id: string; site_id: string }>;
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          org_code: string;
          name: string;
          address: string | null;
          manager_name: string | null;
          manager_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_code: string;
          name: string;
          address?: string | null;
          manager_name?: string | null;
          manager_phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sites"]["Insert"]>;
        Relationships: [];
      };
      buildings: {
        Row: {
          id: string;
          site_id: string;
          building_no: number;
          name: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          building_no: number;
          name?: string | null;
          address?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["buildings"]["Insert"]>;
        Relationships: [];
      };
      floors: {
        Row: {
          id: string;
          building_id: string;
          floor_code: string;
          name: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          floor_code: string;
          name: string;
          order_index?: number;
        };
        Update: Partial<Database["public"]["Tables"]["floors"]["Insert"]>;
        Relationships: [];
      };
      zones: {
        Row: {
          id: string;
          floor_id: string;
          name: string;
          created_at: string;
        };
        Insert: { id?: string; floor_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["zones"]["Insert"]>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          building_id: string;
          vehicle_no: number;
          name: string | null;
          plate_no: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          vehicle_no: number;
          name?: string | null;
          plate_no?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [];
      };
      extinguisher_types: {
        Row: {
          id: string;
          name: string;
          default_useful_life_years: number;
        };
        Insert: {
          id?: string;
          name: string;
          default_useful_life_years?: number;
        };
        Update: Partial<Database["public"]["Tables"]["extinguisher_types"]["Insert"]>;
        Relationships: [];
      };
      extinguishers: {
        Row: {
          id: string;
          location_type: LocationType;
          floor_id: string | null;
          zone_id: string | null;
          vehicle_id: string | null;
          extinguisher_no: number;
          asset_code: string;
          extinguisher_type_id: string;
          manufacture_date: string;
          useful_life_years: number;
          capacity: string | null;
          install_note: string | null;
          status: ExtinguisherStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_type: LocationType;
          floor_id?: string | null;
          zone_id?: string | null;
          vehicle_id?: string | null;
          // 지정하지 않으면 서버(트리거)가 위치 스코프 내에서 자동 채번한다.
          extinguisher_no?: number;
          // 서버(트리거)가 항상 재계산하므로 클라이언트에서 지정할 필요 없음.
          asset_code?: string;
          extinguisher_type_id: string;
          manufacture_date: string;
          useful_life_years: number;
          capacity?: string | null;
          install_note?: string | null;
          status?: ExtinguisherStatus;
        };
        Update: Partial<Database["public"]["Tables"]["extinguishers"]["Insert"]>;
        Relationships: [];
      };
      asset_code_history: {
        Row: {
          id: string;
          extinguisher_id: string;
          asset_code: string;
          changed_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inspections: {
        Row: {
          id: string;
          extinguisher_id: string;
          inspector_id: string;
          pressure_ok: boolean;
          seal_ok: boolean;
          appearance_ok: boolean;
          installation_ok: boolean;
          overall_result: InspectionResult;
          memo: string | null;
          inspected_at: string;
          synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          extinguisher_id: string;
          inspector_id: string;
          pressure_ok: boolean;
          seal_ok: boolean;
          appearance_ok: boolean;
          installation_ok: boolean;
          overall_result: InspectionResult;
          memo?: string | null;
          inspected_at: string;
          synced_at?: string | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      inspection_photos: {
        Row: {
          id: string;
          inspection_id: string;
          storage_path: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          storage_path: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: {
      v_extinguisher_overview: {
        Row: {
          id: string;
          asset_code: string;
          location_type: LocationType;
          extinguisher_no: number;
          status: ExtinguisherStatus;
          manufacture_date: string;
          useful_life_years: number;
          capacity: string | null;
          install_note: string | null;
          replace_due_date: string;
          lifecycle_status: LifecycleStatus;
          extinguisher_type_id: string;
          extinguisher_type_name: string;
          site_id: string;
          site_name: string;
          org_code: string;
          building_id: string | null;
          building_name: string | null;
          building_no: number | null;
          floor_id: string | null;
          floor_name: string | null;
          floor_code: string | null;
          zone_id: string | null;
          zone_name: string | null;
          vehicle_id: string | null;
          vehicle_name: string | null;
          vehicle_no: number | null;
          vehicle_plate_no: string | null;
          last_inspected_at: string | null;
          last_inspection_result: InspectionResult | null;
          last_inspector_id: string | null;
          inspected_today: boolean;
          inspected_this_month: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      fn_extinguisher_status: {
        Args: { p_manufacture_date: string; p_useful_life_years: number };
        Returns: LifecycleStatus;
      };
      fn_dashboard_summary: {
        Args: { p_site_id?: string | null };
        Returns: {
          total_extinguishers: number;
          inspected_today: number;
          not_inspected_today: number;
          due_soon: number;
          expired: number;
          recent_abnormal: number;
        }[];
      };
      fn_inspection_rate: {
        Args: {
          p_group_by?: "building" | "floor" | "zone" | "vehicle";
          p_period?: "today" | "month";
        };
        Returns: {
          group_id: string;
          group_name: string;
          total: number;
          inspected: number;
          rate: number;
        }[];
      };
      fn_submit_inspection: {
        Args: { p_payload: Record<string, unknown> };
        Returns: string;
      };
      fn_find_extinguisher_id_by_code: {
        Args: { p_code: string };
        Returns: string | null;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      has_site_access: { Args: { p_site_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

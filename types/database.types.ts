/**
 * 손으로 작성한 임시 타입 정의.
 * Supabase 프로젝트 연결 후에는 아래 명령으로 자동 생성된 타입으로 교체할 것:
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > types/database.types.ts
 */

export type LifecycleStatus = "normal" | "due_90" | "due_30" | "expired";
export type UserRole = "admin" | "inspector";
export type ExtinguisherStatus = "active" | "replaced" | "disposed";
export type InspectionResult = "normal" | "abnormal";

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
          name: string;
          address: string | null;
          manager_name: string | null;
          manager_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
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
          name: string;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          name: string;
          address?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["buildings"]["Insert"]>;
        Relationships: [];
      };
      floors: {
        Row: {
          id: string;
          building_id: string;
          name: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
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
          qr_token: string;
          code: string;
          floor_id: string;
          zone_id: string | null;
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
          qr_token?: string;
          code: string;
          floor_id: string;
          zone_id?: string | null;
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
          qr_token: string;
          code: string;
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
          building_id: string;
          building_name: string;
          floor_id: string;
          floor_name: string;
          zone_id: string | null;
          zone_name: string | null;
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
        Args: { p_group_by?: "building" | "floor" | "zone"; p_period?: "today" | "month" };
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
      is_admin: { Args: Record<string, never>; Returns: boolean };
      has_site_access: { Args: { p_site_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

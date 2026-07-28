/**
 * 손으로 작성한 임시 타입 정의.
 * Supabase 프로젝트 연결 후에는 아래 명령으로 자동 생성된 타입으로 교체할 것:
 *   npx supabase gen types typescript --project-id <PROJECT_ID> > types/database.types.ts
 */

export type LifecycleStatus = "normal" | "due_90" | "due_30" | "expired" | "none";
export type UserRole = "super_admin" | "admin" | "inspector";
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
          // 가입 트리거가 auth.users의 이메일을 복사해 둔다(승인 화면에서 신청자 식별용).
          email: string | null;
          role: UserRole;
          // 승인 플래그. false면 로그인해도 아무 데이터에 접근할 수 없다.
          is_active: boolean;
          // 자가 회원가입으로 신청한 사업장. 승인하면 null로 비운다.
          // 승인 대기 = is_active === false && pending_site_id !== null
          pending_site_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          role?: UserRole;
          is_active?: boolean;
          pending_site_id?: string | null;
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
      user_parts: {
        Row: { user_id: string; part_id: string };
        Insert: { user_id: string; part_id: string };
        Update: Partial<{ user_id: string; part_id: string }>;
        Relationships: [];
      };
      signup_attempts: {
        // 가입코드 무작위 대입 차단용 시도 기록. 서버 액션(service_role)만 사용.
        Row: { id: number; ip: string; success: boolean; attempted_at: string };
        Insert: { ip: string; success: boolean; attempted_at?: string };
        Update: Partial<{ ip: string; success: boolean }>;
        Relationships: [];
      };
      site_join_codes: {
        // 사업장별 가입코드(사업장당 1행). 점검자가 /signup에서 이 코드로 가입 신청한다.
        Row: { site_id: string; code: string; updated_at: string; updated_by: string | null };
        Insert: { site_id: string; code: string; updated_at?: string; updated_by?: string | null };
        Update: Partial<{ code: string; updated_at: string; updated_by: string | null }>;
        Relationships: [];
      };
      user_site_order: {
        // 관리자 개인별 사업장 표시 순서(관리 화면 상단 버튼). site_order는 site_id를
        // 원하는 순서대로 나열한 배열 — 없는 사업장은 이름순으로 뒤에 붙는다.
        // updated_at의 default now()는 INSERT에만 적용되므로 갱신 시 직접 넣는다.
        Row: { user_id: string; site_order: string[]; updated_at: string };
        Insert: { user_id: string; site_order?: string[]; updated_at?: string };
        Update: Partial<{ user_id: string; site_order: string[]; updated_at: string }>;
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          // 관리번호 prefix는 관리파트(management_parts)로 이전됨. 기존 데이터 호환용으로 보존(신규 사업장은 null).
          org_code: string | null;
          name: string;
          address: string | null;
          manager_name: string | null;
          manager_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_code?: string | null;
          name: string;
          address?: string | null;
          manager_name?: string | null;
          manager_phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sites"]["Insert"]>;
        Relationships: [];
      };
      management_parts: {
        Row: {
          id: string;
          site_id: string;
          code: string;
          name: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          code: string;
          name: string;
          order_index?: number;
        };
        Update: Partial<Database["public"]["Tables"]["management_parts"]["Insert"]>;
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
          department: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          vehicle_no: number;
          name?: string | null;
          plate_no?: string | null;
          department?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [];
      };
      extinguisher_types: {
        Row: {
          id: string;
          name: string;
          default_useful_life_years: number | null;
        };
        Insert: {
          id?: string;
          name: string;
          default_useful_life_years?: number | null;
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
          // 트리거가 비어 있으면 기본 파트로 채우므로 실제로는 항상 채워진다(전환기 nullable).
          part_id: string | null;
          extinguisher_type_id: string;
          manufacture_date: string;
          useful_life_years: number | null;
          capacity: string | null;
          install_note: string | null;
          serial_no: string | null;
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
          // 관리번호 prefix를 결정하는 관리파트. 비우면 트리거가 사업장 기본 파트로 채운다.
          part_id?: string | null;
          extinguisher_type_id: string;
          manufacture_date: string;
          useful_life_years: number | null;
          capacity?: string | null;
          install_note?: string | null;
          serial_no?: string | null;
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
          // 구 항목(2026-07-27 이전 점검 기록 보존용) — 신규 점검에서는 null
          pressure_ok: boolean | null;
          seal_ok: boolean | null;
          appearance_ok: boolean | null;
          installation_ok: boolean | null;
          // 관리대장 점검사항 6개
          agent_discharge_ok: boolean | null;
          agent_caking_ok: boolean | null;
          gauge_ok: boolean | null;
          handle_ok: boolean | null;
          hose_ok: boolean | null;
          hose_holder_ok: boolean | null;
          etc_ok: boolean;
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
          pressure_ok?: boolean | null;
          seal_ok?: boolean | null;
          appearance_ok?: boolean | null;
          installation_ok?: boolean | null;
          agent_discharge_ok?: boolean | null;
          agent_caking_ok?: boolean | null;
          gauge_ok?: boolean | null;
          handle_ok?: boolean | null;
          hose_ok?: boolean | null;
          hose_holder_ok?: boolean | null;
          etc_ok?: boolean;
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
      inspection_actions: {
        Row: {
          id: string;
          inspection_id: string;
          extinguisher_id: string;
          action_note: string;
          resolved_by: string;
          resolved_at: string;
        };
        Insert: {
          id?: string;
          inspection_id: string;
          extinguisher_id: string;
          action_note: string;
          resolved_by: string;
          resolved_at?: string;
        };
        Update: {
          action_note?: string;
        };
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
          useful_life_years: number | null;
          capacity: string | null;
          install_note: string | null;
          replace_due_date: string | null;
          lifecycle_status: LifecycleStatus;
          extinguisher_type_id: string;
          extinguisher_type_name: string;
          site_id: string;
          site_name: string;
          org_code: string | null;
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
          vehicle_department: string | null;
          serial_no: string | null;
          last_inspection_memo: string | null;
          last_pressure_ok: boolean | null;
          last_seal_ok: boolean | null;
          last_appearance_ok: boolean | null;
          last_installation_ok: boolean | null;
          last_inspection_id: string | null;
          last_action_note: string | null;
          last_action_resolved_at: string | null;
          last_etc_ok: boolean | null;
          part_id: string;
          part_code: string;
          part_name: string;
          last_agent_discharge_ok: boolean | null;
          last_agent_caking_ok: boolean | null;
          last_gauge_ok: boolean | null;
          last_handle_ok: boolean | null;
          last_hose_ok: boolean | null;
          last_hose_holder_ok: boolean | null;
        };
        Relationships: [];
      };
      // 목록/QR/수량 페이지용 경량 뷰: 소화기마다 오늘/이번달 점검 여부를 계산하는
      // 무거운 서브쿼리(inspected_today/inspected_this_month)를 제외한 것.
      v_ledger_months: {
        // 관리대장 보관함(/ledgers)용 — 사업장별로 점검이 있었던 달과 그 달 점검 대수.
        Row: {
          site_id: string;
          /** 'YYYY-MM' (KST 기준) */
          month: string;
          /** 그 달에 점검된 소화기 대수(중복 제외) */
          inspected_count: number;
          /** 그 달의 점검 건수(같은 소화기 재점검 포함) */
          inspection_count: number;
          last_inspected_at: string;
        };
        Relationships: [];
      };
      v_extinguisher_list: {
        Row: {
          id: string;
          asset_code: string;
          location_type: LocationType;
          extinguisher_no: number;
          status: ExtinguisherStatus;
          manufacture_date: string;
          useful_life_years: number | null;
          capacity: string | null;
          install_note: string | null;
          replace_due_date: string | null;
          lifecycle_status: LifecycleStatus;
          extinguisher_type_id: string;
          extinguisher_type_name: string;
          site_id: string;
          site_name: string;
          org_code: string | null;
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
          vehicle_department: string | null;
          serial_no: string | null;
          part_id: string;
          part_code: string;
          part_name: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      fn_extinguisher_status: {
        Args: { p_manufacture_date: string; p_useful_life_years: number | null };
        Returns: LifecycleStatus;
      };
      fn_dashboard_summary: {
        Args: { p_site_id?: string | null };
        Returns: {
          total_extinguishers: number;
          inspected_this_month: number;
          not_inspected_this_month: number;
          action_required: number;
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
      has_part_access: { Args: { p_part_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

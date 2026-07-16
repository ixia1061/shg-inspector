import { z } from "zod";

export const buildingSchema = z.object({
  site_id: z.string().uuid("사업장을 선택하세요"),
  building_no: z.number().int().min(1, "건물 번호를 입력하세요"),
  name: z.string().optional(),
  address: z.string().optional(),
});

export type BuildingFormValues = z.infer<typeof buildingSchema>;

export const floorSchema = z.object({
  building_id: z.string().uuid("건물을 선택하세요"),
  floor_code: z
    .string()
    .min(1, "층 코드를 입력하세요 (예: 0=지하, 1=1층, R=옥상)")
    .refine((v) => !v.includes("-"), "관리번호 구분자(-)는 포함할 수 없습니다"),
  name: z.string().min(1, "층 이름을 입력하세요 (예: 3층, 지하1층, 옥상)"),
  order_index: z.number().int(),
});

export type FloorFormValues = z.infer<typeof floorSchema>;

export const zoneSchema = z.object({
  floor_id: z.string().uuid("층을 선택하세요"),
  name: z.string().min(1, "구역명을 입력하세요"),
});

export type ZoneFormValues = z.infer<typeof zoneSchema>;

import { z } from "zod";

// 관리번호(asset_code)는 서버(트리거)가 자동 생성하므로 여기서는 입력받지 않는다.
export const extinguisherSchema = z
  .object({
    location_type: z.enum(["BUILDING", "VEHICLE"]),
    floor_id: z.string().uuid().optional().nullable(),
    zone_id: z.string().uuid().optional().nullable(),
    vehicle_id: z.string().uuid().optional().nullable(),
    extinguisher_type_id: z.string().uuid("소화기 종류를 선택하세요"),
    manufacture_date: z.string().min(1, "제조일을 입력하세요"),
    useful_life_years: z.number().int().min(1).max(30),
    capacity: z.string().optional(),
    install_note: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.location_type === "BUILDING" && !values.floor_id) {
      ctx.addIssue({ code: "custom", path: ["floor_id"], message: "층을 선택하세요" });
    }
    if (values.location_type === "VEHICLE" && !values.vehicle_id) {
      ctx.addIssue({ code: "custom", path: ["vehicle_id"], message: "차량을 선택하세요" });
    }
  });

export type ExtinguisherFormValues = z.infer<typeof extinguisherSchema>;

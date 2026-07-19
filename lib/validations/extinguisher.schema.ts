import { z } from "zod";

// 관리번호(asset_code)는 서버(트리거)가 조합한다. 끝자리(extinguisher_no)는
// 비워두면 자동 채번하고, 지정하면 그 번호로 등록한다(중복 시 저장이 막힌다).
export const extinguisherSchema = z
  .object({
    location_type: z.enum(["BUILDING", "VEHICLE"]),
    floor_id: z.string().uuid().optional().nullable(),
    zone_id: z.string().uuid().optional().nullable(),
    vehicle_id: z.string().uuid().optional().nullable(),
    extinguisher_no: z
      .number({ message: "숫자를 입력하세요" })
      .int("정수를 입력하세요")
      .min(1, "1 이상의 번호를 입력하세요")
      .max(9999)
      .optional(),
    extinguisher_type_id: z.string().uuid("소화기 종류를 선택하세요"),
    // 명판에 제조년월까지만 있어 연·월만 입력받고, 저장 시 해당 월 1일로 처리한다.
    manufacture_date: z
      .string()
      .regex(/^\d{4}-\d{2}$/, "제조년월을 YYYY-MM(연.월) 형식으로 입력하세요")
      .refine((v) => {
        const month = Number(v.slice(5, 7));
        return month >= 1 && month <= 12;
      }, "올바른 월이 아닙니다"),
    // null = 내용연수 없음 (이산화탄소·할론 등)
    useful_life_years: z
      .number({ message: "내용연수를 입력하거나 '내용연수 없음'을 선택하세요" })
      .int()
      .min(1, "1년 이상이어야 합니다")
      .max(30)
      .nullable(),
    capacity: z.string().optional(),
    install_note: z.string().optional(),
    serial_no: z.string().optional(),
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

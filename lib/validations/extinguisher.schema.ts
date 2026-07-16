import { z } from "zod";

export const extinguisherSchema = z.object({
  code: z.string().min(1, "관리번호를 입력하세요"),
  floor_id: z.string().uuid("층을 선택하세요"),
  zone_id: z.string().uuid().optional().nullable(),
  extinguisher_type_id: z.string().uuid("소화기 종류를 선택하세요"),
  manufacture_date: z.string().min(1, "제조일을 입력하세요"),
  useful_life_years: z.number().int().min(1).max(30),
  capacity: z.string().optional(),
  install_note: z.string().optional(),
});

export type ExtinguisherFormValues = z.infer<typeof extinguisherSchema>;

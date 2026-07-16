import { z } from "zod";

export const extinguisherTypeSchema = z.object({
  name: z.string().min(1, "종류명을 입력하세요"),
  default_useful_life_years: z.number().int().min(1, "1년 이상이어야 합니다").max(30),
});

export type ExtinguisherTypeFormValues = z.infer<typeof extinguisherTypeSchema>;

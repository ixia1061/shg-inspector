import { z } from "zod";

export const extinguisherTypeSchema = z.object({
  name: z.string().min(1, "종류명을 입력하세요"),
  // null = 내용연수 없음
  default_useful_life_years: z
    .number({ message: "내용연수를 입력하거나 '내용연수 없음'을 선택하세요" })
    .int()
    .min(1, "1년 이상이어야 합니다")
    .max(30)
    .nullable(),
});

export type ExtinguisherTypeFormValues = z.infer<typeof extinguisherTypeSchema>;

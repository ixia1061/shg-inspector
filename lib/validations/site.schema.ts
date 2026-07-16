import { z } from "zod";

export const siteSchema = z.object({
  org_code: z
    .string()
    .min(1, "관리기관 코드를 입력하세요")
    .max(10, "10자 이내로 입력하세요")
    .refine((v) => !v.includes("-"), "관리번호 구분자(-)는 포함할 수 없습니다"),
  name: z.string().min(1, "사업장명을 입력하세요"),
  address: z.string().optional(),
  manager_name: z.string().optional(),
  manager_phone: z.string().optional(),
});

export type SiteFormValues = z.infer<typeof siteSchema>;

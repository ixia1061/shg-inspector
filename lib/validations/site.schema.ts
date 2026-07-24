import { z } from "zod";

// 관리번호 prefix는 관리파트(management_parts)가 담당하므로 사업장은 코드를 받지 않는다.
export const siteSchema = z.object({
  name: z.string().min(1, "사업장명을 입력하세요"),
  address: z.string().optional(),
  manager_name: z.string().optional(),
  manager_phone: z.string().optional(),
});

export type SiteFormValues = z.infer<typeof siteSchema>;

import { z } from "zod";

export const siteSchema = z.object({
  name: z.string().min(1, "사업장명을 입력하세요"),
  address: z.string().optional(),
  manager_name: z.string().optional(),
  manager_phone: z.string().optional(),
});

export type SiteFormValues = z.infer<typeof siteSchema>;

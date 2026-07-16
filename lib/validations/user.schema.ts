import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().min(1, "이메일을 입력하세요").email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  name: z.string().min(1, "이름을 입력하세요"),
  role: z.enum(["admin", "inspector"]),
  siteIds: z.array(z.string().uuid()),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().min(1, "이메일을 입력하세요").email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  name: z.string().min(1, "이름을 입력하세요"),
  role: z.enum(["admin", "inspector"]),
  /** 담당 사업장(사업장 단위). 관리자는 자기 담당 사업장만 고를 수 있다. */
  siteIds: z.array(z.string().uuid()),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

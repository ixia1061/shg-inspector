import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().min(1, "이메일을 입력하세요").email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  name: z.string().min(1, "이름을 입력하세요"),
  /** 소속(부서·업체). 관리자가 직접 만들 때는 이미 아는 사람이므로 선택 입력. */
  affiliation: z.string().max(50, "소속은 50자 이내로 입력하세요").optional(),
  role: z.enum(["admin", "inspector"]),
  /** 담당 사업장(사업장 단위). 관리자는 자기 담당 사업장만 고를 수 있다. */
  siteIds: z.array(z.string().uuid()),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

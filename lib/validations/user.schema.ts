import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().min(1, "이메일을 입력하세요").email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
  name: z.string().min(1, "이름을 입력하세요"),
  role: z.enum(["admin", "inspector"]),
  /** 사업장 "전체" 배정 — 시스템관리자만 지정할 수 있다. */
  siteIds: z.array(z.string().uuid()),
  /** 관리파트 단위 배정 — 관리자가 자기 범위의 점검자를 만들 때 쓴다. */
  partIds: z.array(z.string().uuid()),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

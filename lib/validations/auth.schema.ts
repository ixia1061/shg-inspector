import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "이메일을 입력하세요").email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string().min(1, "비밀번호를 다시 입력하세요"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

/**
 * 점검자 가입 신청. 가입코드로 어느 사업장에 신청하는지 정해지고,
 * 그 사업장 관리자가 승인해야 실제로 로그인해서 점검할 수 있다.
 * 비로그인 진입점이라 서버 액션에서도 이 스키마로 다시 검증한다.
 */
export const signupSchema = z.object({
  joinCode: z.string().min(1, "가입코드를 입력하세요"),
  name: z.string().min(1, "이름을 입력하세요"),
  email: z.string().min(1, "이메일을 입력하세요").email("올바른 이메일 형식이 아닙니다"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

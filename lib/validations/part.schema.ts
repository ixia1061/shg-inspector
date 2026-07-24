import { z } from "zod";

// 관리파트 코드는 관리번호(asset_code)의 앞자리로 쓰이므로 구분자(-)를 포함할 수 없고 전체에서 유일하다.
export const partSchema = z.object({
  code: z
    .string()
    .min(1, "파트 코드를 입력하세요")
    .max(10, "10자 이내로 입력하세요")
    .refine((v) => !v.includes("-"), "관리번호 구분자(-)는 포함할 수 없습니다")
    .refine((v) => v !== "차", "'차'는 차량 전용 예약어라 사용할 수 없습니다"),
  name: z.string().min(1, "파트 이름을 입력하세요"),
});

export type PartFormValues = z.infer<typeof partSchema>;

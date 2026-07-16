import { z } from "zod";

export const vehicleSchema = z.object({
  site_id: z.string().uuid("사업장을 선택하세요"),
  vehicle_no: z.number().int().min(1, "차량 번호를 입력하세요"),
  name: z.string().optional(),
});

export type VehicleFormValues = z.infer<typeof vehicleSchema>;

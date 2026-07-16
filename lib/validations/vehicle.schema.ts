import { z } from "zod";

export const vehicleSchema = z.object({
  building_id: z.string().uuid("건물을 선택하세요"),
  vehicle_no: z.number().int().min(1, "차량 번호를 입력하세요"),
  plate_no: z.string().optional(),
  name: z.string().optional(),
});

export type VehicleFormValues = z.infer<typeof vehicleSchema>;

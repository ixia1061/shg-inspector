import { z } from "zod";

export const inspectionSchema = z.object({
  extinguisher_id: z.string().uuid(),
  pressure_ok: z.boolean(),
  seal_ok: z.boolean(),
  appearance_ok: z.boolean(),
  installation_ok: z.boolean(),
  memo: z.string().optional(),
  inspected_at: z.string(),
  photo_paths: z.array(z.string()).default([]),
});

export type InspectionFormValues = z.infer<typeof inspectionSchema>;

/** 4개 체크항목이 모두 정상일 때만 overall_result가 'normal'이 된다. */
export function computeOverallResult(
  values: Pick<InspectionFormValues, "pressure_ok" | "seal_ok" | "appearance_ok" | "installation_ok">
): "normal" | "abnormal" {
  const allOk =
    values.pressure_ok && values.seal_ok && values.appearance_ok && values.installation_ok;
  return allOk ? "normal" : "abnormal";
}

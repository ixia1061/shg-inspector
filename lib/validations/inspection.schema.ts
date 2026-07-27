import { z } from "zod";

import { INSPECTION_CHECK_ITEMS, type InspectionCheckKey } from "@/lib/utils/inspection";

export const inspectionSchema = z.object({
  extinguisher_id: z.string().uuid(),
  agent_discharge_ok: z.boolean(),
  agent_caking_ok: z.boolean(),
  gauge_ok: z.boolean(),
  handle_ok: z.boolean(),
  hose_ok: z.boolean(),
  hose_holder_ok: z.boolean(),
  etc_ok: z.boolean(),
  memo: z.string().optional(),
  inspected_at: z.string(),
  photo_paths: z.array(z.string()).default([]),
});

export type InspectionFormValues = z.infer<typeof inspectionSchema>;

/** 체크항목(점검사항 6개 + 기타사항)이 모두 정상일 때만 overall_result가 'normal'이 된다. */
export function computeOverallResult(
  values: Record<InspectionCheckKey, boolean>
): "normal" | "abnormal" {
  return INSPECTION_CHECK_ITEMS.every((item) => values[item.key]) ? "normal" : "abnormal";
}

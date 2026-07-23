import { offlineDB, type OutboxInspection, type OutboxPhoto } from "@/lib/offline/db";
import type { InspectionResult } from "@/types/domain";

export interface EnqueueInspectionInput {
  extinguisher_id: string;
  pressure_ok: boolean;
  seal_ok: boolean;
  appearance_ok: boolean;
  installation_ok: boolean;
  etc_ok: boolean;
  overall_result: InspectionResult;
  memo: string | null;
  inspected_at: string;
  photos: OutboxPhoto[];
}

export async function enqueueInspection(input: EnqueueInspectionInput): Promise<string> {
  const localId = crypto.randomUUID();
  const record: OutboxInspection = {
    localId,
    ...input,
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  await offlineDB.outbox.add(record);
  return localId;
}

export function listPendingInspections() {
  return offlineDB.outbox.where("status").anyOf(["pending", "failed"]).sortBy("createdAt");
}

export function countPendingInspections() {
  return offlineDB.outbox.where("status").anyOf(["pending", "failed"]).count();
}

export async function markSyncing(localId: string) {
  await offlineDB.outbox.update(localId, { status: "syncing" });
}

export async function markFailed(localId: string, error: string) {
  const current = await offlineDB.outbox.get(localId);
  await offlineDB.outbox.update(localId, {
    status: "failed",
    retryCount: (current?.retryCount ?? 0) + 1,
    lastError: error,
  });
}

export async function removeFromOutbox(localId: string) {
  await offlineDB.outbox.delete(localId);
}

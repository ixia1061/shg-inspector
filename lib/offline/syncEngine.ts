import { trimExtinguisherPhotosAction } from "@/app/actions/photoActions";
import { createClient } from "@/lib/supabase/client";
import {
  listPendingInspections,
  markFailed,
  markSyncing,
  removeFromOutbox,
} from "@/lib/offline/outbox";
import type { OutboxInspection } from "@/lib/offline/db";

const PHOTO_BUCKET = "inspection-photos";

let isSyncing = false;

/** 대기 중인 오프라인 점검을 순서대로(등록 순) 서버에 반영한다. */
export async function flushOutbox(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  const supabase = createClient();
  let synced = 0;
  let failed = 0;

  try {
    const pending = await listPendingInspections();

    for (const item of pending) {
      try {
        await markSyncing(item.localId);
        await submitOne(supabase, item);
        await removeFromOutbox(item.localId);
        synced += 1;
      } catch (err) {
        await markFailed(item.localId, err instanceof Error ? err.message : String(err));
        failed += 1;
      }
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

async function submitOne(
  supabase: ReturnType<typeof createClient>,
  item: OutboxInspection
): Promise<void> {
  const photoPaths: string[] = [];

  for (const photo of item.photos) {
    const path = `${item.extinguisher_id}/${item.localId}-${photo.fileName}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo.blob, {
      upsert: true,
    });
    if (error) throw error;
    photoPaths.push(path);
  }

  const { error } = await supabase.rpc("fn_submit_inspection", {
    p_payload: {
      extinguisher_id: item.extinguisher_id,
      pressure_ok: item.pressure_ok,
      seal_ok: item.seal_ok,
      appearance_ok: item.appearance_ok,
      installation_ok: item.installation_ok,
      overall_result: item.overall_result,
      memo: item.memo,
      inspected_at: item.inspected_at,
      photo_paths: photoPaths,
    },
  });

  if (error) throw error;

  // 소화기당 최신 5장만 유지 — 실패해도 동기화 성공에는 영향 없음
  if (photoPaths.length > 0) {
    void trimExtinguisherPhotosAction(item.extinguisher_id).catch(() => {});
  }
}

/** online 이벤트가 발생할 때마다 자동으로 Outbox를 flush하도록 등록한다. */
export function registerAutoSync(): () => void {
  const handler = () => {
    void flushOutbox();
  };
  window.addEventListener("online", handler);
  if (navigator.onLine) void flushOutbox();
  return () => window.removeEventListener("online", handler);
}

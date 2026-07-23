import Dexie, { type Table } from "dexie";

import type { ExtinguisherOverview, InspectionResult } from "@/types/domain";

export interface OutboxPhoto {
  blob: Blob;
  fileName: string;
}

export interface OutboxInspection {
  /** 클라이언트에서 생성하는 UUID. 동기화 중복 제출을 막는 멱등키로도 쓰인다. */
  localId: string;
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
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastError?: string;
  createdAt: string;
}

class OfflineDB extends Dexie {
  // QR 스캔 시 오프라인이어도 최근 조회한 소화기 정보를 보여주기 위한 캐시
  extinguisherCache!: Table<ExtinguisherOverview, string>;
  // 오프라인 상태에서 제출된 점검을 순서대로 재전송하기 위한 Outbox
  outbox!: Table<OutboxInspection, string>;

  constructor() {
    super("shg-inspector-offline");
    this.version(1).stores({
      extinguisherCache: "id, asset_code",
      outbox: "localId, status, createdAt",
    });
  }
}

export const offlineDB = new OfflineDB();

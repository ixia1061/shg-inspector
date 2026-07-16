import { PhotoManager, type ManagedPhoto } from "@/components/admin/PhotoManager";
import { createClient } from "@/lib/supabase/server";

export default async function PhotosPage() {
  const supabase = await createClient();

  const { data: photoRows } = await supabase
    .from("inspection_photos")
    .select("id, storage_path, inspection_id, created_at")
    .order("created_at", { ascending: false });

  const rows = photoRows ?? [];

  // 사진 → 점검 → 소화기(관리번호) 연결
  const inspectionIds = [...new Set(rows.map((r) => r.inspection_id))];
  const { data: inspections } = inspectionIds.length
    ? await supabase
        .from("inspections")
        .select("id, extinguisher_id, inspected_at")
        .in("id", inspectionIds)
    : { data: [] };
  const inspectionById = new Map((inspections ?? []).map((i) => [i.id, i]));

  const extinguisherIds = [...new Set((inspections ?? []).map((i) => i.extinguisher_id))];
  const { data: extinguishers } = extinguisherIds.length
    ? await supabase.from("extinguishers").select("id, asset_code").in("id", extinguisherIds)
    : { data: [] };
  const assetCodeById = new Map((extinguishers ?? []).map((e) => [e.id, e.asset_code]));

  // 비공개 버킷 → 서명 URL(1시간)
  const paths = rows.map((r) => r.storage_path);
  const { data: signedUrls } = paths.length
    ? await supabase.storage.from("inspection-photos").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlByPath = new Map(
    (signedUrls ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const photos: ManagedPhoto[] = rows
    .map((r) => {
      const inspection = inspectionById.get(r.inspection_id);
      const url = urlByPath.get(r.storage_path);
      if (!url) return null;
      return {
        id: r.id,
        url,
        assetCode: inspection ? (assetCodeById.get(inspection.extinguisher_id) ?? "알 수 없음") : "알 수 없음",
        inspectedAt: inspection?.inspected_at ?? null,
      };
    })
    .filter((p): p is ManagedPhoto => p !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">사진 관리</h1>
        <p className="text-muted-foreground text-sm">
          점검 사진을 관리번호별로 확인하고 일괄 삭제할 수 있습니다. 사진은 소화기 1대당 최신
          5장까지만 자동 보관됩니다.
        </p>
      </div>
      <PhotoManager photos={photos} />
    </div>
  );
}

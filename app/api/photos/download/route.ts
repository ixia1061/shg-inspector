import JSZip from "jszip";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PHOTO_BUCKET = "inspection-photos";

/**
 * 관리자 전용: 점검 사진을 ZIP으로 묶어 내려준다.
 * body.photoIds가 비어 있으면 전체 사진을 대상으로 한다.
 * ZIP 내부 구조: {관리번호}/{점검일}-{n}.jpg
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "관리자만 사용할 수 있습니다" }, { status: 403 });
  }

  const { photoIds } = (await request.json().catch(() => ({}))) as { photoIds?: string[] };

  const admin = createAdminClient();

  let query = admin
    .from("inspection_photos")
    .select("id, storage_path, inspection_id")
    .order("created_at");
  if (photoIds?.length) {
    query = query.in("id", photoIds);
  }
  const { data: photos } = await query;

  if (!photos?.length) {
    return NextResponse.json({ error: "다운로드할 사진이 없습니다" }, { status: 404 });
  }

  // 사진 → 점검 → 관리번호 매핑 (ZIP 폴더/파일명 구성용)
  const inspectionIds = [...new Set(photos.map((p) => p.inspection_id))];
  const { data: inspections } = await admin
    .from("inspections")
    .select("id, extinguisher_id, inspected_at")
    .in("id", inspectionIds);
  const inspectionById = new Map((inspections ?? []).map((i) => [i.id, i]));

  const extinguisherIds = [...new Set((inspections ?? []).map((i) => i.extinguisher_id))];
  const { data: extinguishers } = extinguisherIds.length
    ? await admin.from("extinguishers").select("id, asset_code").in("id", extinguisherIds)
    : { data: [] };
  const assetCodeById = new Map((extinguishers ?? []).map((e) => [e.id, e.asset_code]));

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const photo of photos) {
    const { data: blob, error } = await admin.storage.from(PHOTO_BUCKET).download(photo.storage_path);
    if (error || !blob) continue;

    const inspection = inspectionById.get(photo.inspection_id);
    const assetCode = inspection
      ? (assetCodeById.get(inspection.extinguisher_id) ?? "알수없음")
      : "알수없음";
    const date = inspection ? inspection.inspected_at.slice(0, 10) : "unknown";

    const base = `${assetCode}/${date}`;
    let name = `${base}.jpg`;
    let n = 1;
    while (usedNames.has(name)) {
      n += 1;
      name = `${base}-${n}.jpg`;
    }
    usedNames.add(name);

    zip.file(name, await blob.arrayBuffer());
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  const filename = `점검사진_${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="photos.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

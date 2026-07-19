"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";

const PHOTO_BUCKET = "inspection-photos";

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) throw new Error("관리자만 사용할 수 있습니다");
  return { supabase };
}

/**
 * 관리자 전용: 폐기·철수한 소화기를 완전 삭제한다.
 * 점검기록(inspections)·사진 메타(inspection_photos)는 FK cascade로 함께 삭제되고,
 * Storage 버킷의 실제 사진 파일은 cascade 대상이 아니므로 여기서 별도로 정리한다.
 * 되돌릴 수 없다.
 *
 * - 소화기 행 삭제는 RLS 사용자 클라이언트로 수행 → 담당 사업장 밖 소화기는 삭제되지 않는다.
 * - 사진 파일 삭제만 service_role(admin) 클라이언트로 처리한다.
 */
export async function deleteExtinguisherAction(extinguisherId: string) {
  const { supabase } = await assertAdmin();
  const admin = createAdminClient();

  // 삭제(cascade)로 inspection_photos 행이 사라지기 전에 Storage 경로를 먼저 확보한다.
  const { data: inspections } = await admin
    .from("inspections")
    .select("id")
    .eq("extinguisher_id", extinguisherId);
  const inspectionIds = (inspections ?? []).map((r) => r.id);

  let storagePaths: string[] = [];
  if (inspectionIds.length) {
    const { data: photos } = await admin
      .from("inspection_photos")
      .select("storage_path")
      .in("inspection_id", inspectionIds);
    storagePaths = (photos ?? []).map((p) => p.storage_path);
  }

  // 소화기 행 삭제 (RLS로 담당 사업장만 허용). 반환 행이 없으면 권한 없음/이미 삭제됨.
  const { data: deleted, error } = await supabase
    .from("extinguishers")
    .delete()
    .eq("id", extinguisherId)
    .select("id, asset_code");
  if (error) throw new Error(error.message);
  if (!deleted?.length) throw new Error("삭제 권한이 없거나 이미 삭제된 소화기입니다");

  // 고아가 된 사진 파일 정리 (실패해도 삭제 자체는 완료된 것으로 본다)
  if (storagePaths.length) {
    await admin.storage.from(PHOTO_BUCKET).remove(storagePaths);
  }

  revalidatePath("/extinguishers");
  revalidatePath("/inspections");
  revalidatePath("/inventory");
  revalidatePath("/lifecycle");

  return { asset_code: deleted[0].asset_code, photos: storagePaths.length };
}

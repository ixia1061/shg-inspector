"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";

// 소화기(관리번호) 1대당 서버에 보관하는 최대 사진 수
const MAX_PHOTOS_PER_EXTINGUISHER = 5;

const PHOTO_BUCKET = "inspection-photos";

async function assertLoggedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  return { supabase, user };
}

async function assertAdmin() {
  const { supabase, user } = await assertLoggedIn();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!isAdminRole(profile?.role)) throw new Error("관리자만 사용할 수 있습니다");
  return user;
}

/**
 * 해당 소화기의 사진을 최신 5장만 남기고 오래된 것부터 삭제한다.
 * 점검 제출 직후 호출되어 서버 용량이 무한정 쌓이는 것을 막는다.
 * (점검 기록 자체는 그대로 보존되고 사진 파일만 정리된다)
 */
export async function trimExtinguisherPhotosAction(extinguisherId: string) {
  await assertLoggedIn();

  const admin = createAdminClient();

  const { data: inspectionRows } = await admin
    .from("inspections")
    .select("id")
    .eq("extinguisher_id", extinguisherId);

  const inspectionIds = (inspectionRows ?? []).map((r) => r.id);
  if (!inspectionIds.length) return { deleted: 0 };

  const { data: photos } = await admin
    .from("inspection_photos")
    .select("id, storage_path")
    .in("inspection_id", inspectionIds)
    .order("created_at", { ascending: false });

  const excess = (photos ?? []).slice(MAX_PHOTOS_PER_EXTINGUISHER);
  if (!excess.length) return { deleted: 0 };

  await admin.storage.from(PHOTO_BUCKET).remove(excess.map((p) => p.storage_path));
  await admin
    .from("inspection_photos")
    .delete()
    .in(
      "id",
      excess.map((p) => p.id)
    );

  return { deleted: excess.length };
}

/** 관리자 전용: 선택한 사진들을 스토리지와 DB에서 함께 삭제한다. */
export async function deletePhotosAction(photoIds: string[]) {
  await assertAdmin();
  if (!photoIds.length) return { deleted: 0 };

  const admin = createAdminClient();

  const { data: photos } = await admin
    .from("inspection_photos")
    .select("id, storage_path")
    .in("id", photoIds);

  if (!photos?.length) return { deleted: 0 };

  await admin.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
  await admin
    .from("inspection_photos")
    .delete()
    .in(
      "id",
      photos.map((p) => p.id)
    );

  revalidatePath("/photos");
  return { deleted: photos.length };
}

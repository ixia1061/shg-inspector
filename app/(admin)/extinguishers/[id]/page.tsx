import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminInspectDialog } from "@/components/admin/AdminInspectDialog";
import { ExtinguisherForm } from "@/components/admin/ExtinguisherForm";
import { InspectionHistoryTimeline } from "@/components/admin/InspectionHistoryTimeline";
import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatShortLocation } from "@/lib/utils/location";
import { createClient } from "@/lib/supabase/server";

export default async function ExtinguisherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: overview } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .eq("id", id)
    .single();

  if (!overview) notFound();

  const { data: extinguisher } = await supabase
    .from("extinguishers")
    .select("*")
    .eq("id", id)
    .single();

  const [
    { data: sites },
    { data: buildings },
    { data: floors },
    { data: vehicles },
    { data: types },
  ] = await Promise.all([
    supabase.from("sites").select("*").order("name"),
    supabase.from("buildings").select("*").order("building_no"),
    supabase.from("floors").select("*").order("order_index"),
    supabase.from("vehicles").select("*").order("vehicle_no"),
    supabase.from("extinguisher_types").select("*").order("name"),
  ]);

  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, inspected_at, overall_result, memo, inspector_id")
    .eq("extinguisher_id", id)
    .order("inspected_at", { ascending: false });

  const inspectorIds = [...new Set((inspections ?? []).map((i) => i.inspector_id))];
  const { data: inspectors } = inspectorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", inspectorIds)
    : { data: [] };

  const inspectionIds = (inspections ?? []).map((i) => i.id);
  const { data: photos } = inspectionIds.length
    ? await supabase
        .from("inspection_photos")
        .select("inspection_id, storage_path")
        .in("inspection_id", inspectionIds)
    : { data: [] };

  // 비공개 버킷이므로 서명 URL(1시간 유효)을 만들어 썸네일/원본을 보여준다.
  const photoPaths = (photos ?? []).map((p) => p.storage_path);
  const { data: signedUrls } = photoPaths.length
    ? await supabase.storage.from("inspection-photos").createSignedUrls(photoPaths, 3600)
    : { data: [] };
  const signedUrlByPath = new Map(
    (signedUrls ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const inspectorNameById = new Map((inspectors ?? []).map((p) => [p.id, p.name]));
  const photoUrlsByInspection = (photos ?? []).reduce<Record<string, string[]>>((acc, p) => {
    const url = signedUrlByPath.get(p.storage_path);
    if (url) (acc[p.inspection_id] ??= []).push(url);
    return acc;
  }, {});

  const historyItems = (inspections ?? []).map((i) => ({
    id: i.id,
    inspected_at: i.inspected_at,
    overall_result: i.overall_result,
    memo: i.memo,
    inspector_name: inspectorNameById.get(i.inspector_id) ?? "알 수 없음",
    photo_urls: photoUrlsByInspection[i.id] ?? [],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">{overview.asset_code}</h1>
          <p className="text-muted-foreground text-sm">{formatShortLocation(overview)}</p>
        </div>
        <div className="flex items-center gap-2">
          <LifecycleStatusBadge status={overview.lifecycle_status} />
          <AdminInspectDialog extinguisher={overview} variant="detail" />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/extinguishers/${id}/label`} />}
          >
            QR/라벨
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보 수정</CardTitle>
          </CardHeader>
          <CardContent>
            {extinguisher && (
              <ExtinguisherForm
                sites={sites ?? []}
                buildings={buildings ?? []}
                floors={floors ?? []}
                vehicles={vehicles ?? []}
                types={types ?? []}
                extinguisher={extinguisher}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>점검 이력</CardTitle>
          </CardHeader>
          <CardContent>
            <InspectionHistoryTimeline items={historyItems} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

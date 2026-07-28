import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminInspectDialog } from "@/components/admin/AdminInspectDialog";
import { BackButton } from "@/components/shared/BackButton";
import { DeleteExtinguisherButton } from "@/components/admin/DeleteExtinguisherButton";
import { ExtinguisherForm } from "@/components/admin/ExtinguisherForm";
import { InspectionHistoryTimeline } from "@/components/admin/InspectionHistoryTimeline";
import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWritablePartIds } from "@/lib/auth";
import { defectItemsTextOfInspection } from "@/lib/utils/inspection";
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
    { data: parts },
    { data: buildings },
    { data: floors },
    { data: vehicles },
    { data: types },
    writableParts,
  ] = await Promise.all([
    supabase.from("sites").select("*").order("name"),
    supabase.from("management_parts").select("*").order("order_index"),
    supabase.from("buildings").select("*").order("building_no"),
    supabase.from("floors").select("*").order("order_index"),
    supabase.from("vehicles").select("*").order("vehicle_no"),
    supabase.from("extinguisher_types").select("*").order("name"),
    getWritablePartIds(),
  ]);

  // 권한 범위 파트만 노출하되, 현재 소화기의 파트는 항상 포함(수정 화면에서 선택 유지).
  const visibleParts = writableParts
    ? (parts ?? []).filter((p) => writableParts.has(p.id) || p.id === extinguisher?.part_id)
    : (parts ?? []);

  // 점검사항 컬럼까지 가져와 이력에 "어디가 불량이었는지"를 함께 보여준다.
  const { data: inspections } = await supabase
    .from("inspections")
    .select("*")
    .eq("extinguisher_id", id)
    .order("inspected_at", { ascending: false });

  const inspectionIds = (inspections ?? []).map((i) => i.id);

  // 이상 점검에 대한 조치 기록. 이게 없으면 이력에 "이상"만 남아 어떻게 처리했는지 알 수 없다.
  const { data: actions } = inspectionIds.length
    ? await supabase
        .from("inspection_actions")
        .select("inspection_id, action_note, resolved_at, resolved_by")
        .in("inspection_id", inspectionIds)
    : { data: [] };

  const inspectorIds = [
    ...new Set([
      ...(inspections ?? []).map((i) => i.inspector_id),
      ...(actions ?? []).map((a) => a.resolved_by),
    ]),
  ].filter(Boolean) as string[];
  const { data: inspectors } = inspectorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", inspectorIds)
    : { data: [] };
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

  const actionByInspection = new Map((actions ?? []).map((a) => [a.inspection_id, a]));

  const historyItems = (inspections ?? []).map((i) => {
    const action = actionByInspection.get(i.id);
    return {
      id: i.id,
      inspected_at: i.inspected_at,
      overall_result: i.overall_result,
      memo: i.memo,
      defect_items: defectItemsTextOfInspection(i),
      inspector_name: inspectorNameById.get(i.inspector_id) ?? "알 수 없음",
      photo_urls: photoUrlsByInspection[i.id] ?? [],
      action: action
        ? {
            note: action.action_note,
            resolved_at: action.resolved_at,
            resolved_by_name: inspectorNameById.get(action.resolved_by) ?? "알 수 없음",
          }
        : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackButton label="목록으로" />
      </div>
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
          <DeleteExtinguisherButton
            id={id}
            assetCode={overview.asset_code}
            hasHistory={(inspections?.length ?? 0) > 0}
          />
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
                parts={visibleParts}
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

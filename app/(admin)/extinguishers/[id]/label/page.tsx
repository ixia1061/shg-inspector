import { notFound } from "next/navigation";

import { QrLabelPreview } from "@/components/admin/QrLabelPreview";
import { buildInspectionUrl } from "@/lib/qr/encode";
import { createClient } from "@/lib/supabase/server";

export default async function ExtinguisherLabelPage({
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

  const location = [overview.building_name, overview.floor_name, overview.zone_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-bold">QR 라벨 — {overview.code}</h1>
      <QrLabelPreview url={buildInspectionUrl(overview.qr_token)} code={overview.code} location={location} />
    </div>
  );
}

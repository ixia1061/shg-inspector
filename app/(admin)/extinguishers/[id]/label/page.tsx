import { notFound } from "next/navigation";

import { QrLabelPreview } from "@/components/admin/QrLabelPreview";
import { buildInspectionUrl } from "@/lib/qr/encode";
import { formatShortLocation } from "@/lib/utils/location";
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

  const location = formatShortLocation(overview);

  return (
    <div className="flex flex-col items-center gap-6">
      <h1 className="text-2xl font-bold font-mono">QR 라벨 — {overview.asset_code}</h1>
      <QrLabelPreview
        url={buildInspectionUrl(overview.asset_code)}
        code={overview.asset_code}
        location={location}
      />
    </div>
  );
}

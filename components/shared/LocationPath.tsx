export function LocationPath({
  siteName,
  buildingName,
  floorName,
  zoneName,
}: {
  siteName: string;
  buildingName: string;
  floorName: string;
  zoneName?: string | null;
}) {
  const parts = [siteName, buildingName, floorName, zoneName].filter(Boolean);
  return <span className="text-muted-foreground text-sm">{parts.join(" > ")}</span>;
}

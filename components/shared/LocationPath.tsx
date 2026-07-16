import { formatLocationPath } from "@/lib/utils/location";
import type { ExtinguisherOverview } from "@/types/domain";

type LocationFields = Parameters<typeof formatLocationPath>[0];

export function LocationPath({ extinguisher }: { extinguisher: LocationFields | ExtinguisherOverview }) {
  return <span className="text-muted-foreground text-sm">{formatLocationPath(extinguisher)}</span>;
}

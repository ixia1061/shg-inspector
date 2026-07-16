import { Badge } from "@/components/ui/badge";
import { LIFECYCLE_STATUS_LABEL } from "@/lib/utils/lifecycle";
import type { LifecycleStatus } from "@/types/domain";

const VARIANT: Record<LifecycleStatus, "default" | "secondary" | "destructive" | "outline"> = {
  normal: "secondary",
  due_90: "outline",
  due_30: "default",
  expired: "destructive",
  none: "outline",
};

export function LifecycleStatusBadge({ status }: { status: LifecycleStatus }) {
  return <Badge variant={VARIANT[status]}>{LIFECYCLE_STATUS_LABEL[status]}</Badge>;
}

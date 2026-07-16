import Link from "next/link";

import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLocationPath } from "@/lib/utils/location";
import { createClient } from "@/lib/supabase/server";

export default async function LifecyclePage() {
  const supabase = await createClient();

  const { data: extinguishers } = await supabase
    .from("v_extinguisher_overview")
    .select("*")
    .in("lifecycle_status", ["due_90", "due_30", "expired"])
    .order("replace_due_date");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">내용연수 관리</h1>
        <p className="text-muted-foreground text-sm">
          교체 예정일이 90일 이내이거나 이미 만료된 소화기 목록입니다.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>관리번호</TableHead>
            <TableHead>위치</TableHead>
            <TableHead>제조일</TableHead>
            <TableHead>교체 예정일</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extinguishers?.length ? (
            extinguishers.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/extinguishers/${e.id}`} className="font-mono font-medium hover:underline">
                    {e.asset_code}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatLocationPath(e)}</TableCell>
                <TableCell>{e.manufacture_date}</TableCell>
                <TableCell>{e.replace_due_date}</TableCell>
                <TableCell>
                  <LifecycleStatusBadge status={e.lifecycle_status} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                교체가 필요한 소화기가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

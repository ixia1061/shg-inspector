import Link from "next/link";

import { AdminInspectDialog } from "@/components/admin/AdminInspectDialog";
import { ExtinguisherFilters } from "@/components/admin/ExtinguisherFilters";
import { LifecycleStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShortLocation } from "@/lib/utils/location";
import { createClient } from "@/lib/supabase/server";
import type { LifecycleStatus } from "@/types/domain";

export default async function ExtinguishersPage({
  searchParams,
}: {
  searchParams: Promise<{ asset_code?: string; site_id?: string; status?: string }>;
}) {
  const { asset_code, site_id, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("v_extinguisher_overview").select("*").order("asset_code");

  if (asset_code) query = query.ilike("asset_code", `%${asset_code}%`);
  if (site_id) query = query.eq("site_id", site_id);
  if (status) query = query.eq("lifecycle_status", status as LifecycleStatus);

  const [{ data: extinguishers }, { data: sites }] = await Promise.all([
    query,
    supabase.from("sites").select("*").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">소화기 관리</h1>
        <Button nativeButton={false} render={<Link href="/extinguishers/new" />}>
          새 소화기 등록
        </Button>
      </div>

      <ExtinguisherFilters sites={sites ?? []} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>관리번호</TableHead>
            <TableHead>위치</TableHead>
            <TableHead>종류</TableHead>
            <TableHead>내용연수 상태</TableHead>
            <TableHead>최근 점검</TableHead>
            <TableHead className="text-right">점검</TableHead>
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
                <TableCell className="text-muted-foreground text-sm">{formatShortLocation(e)}</TableCell>
                <TableCell>
                  {e.extinguisher_type_name}
                  {e.capacity ? ` (${e.capacity})` : ""}
                </TableCell>
                <TableCell>
                  <LifecycleStatusBadge status={e.lifecycle_status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {e.last_inspected_at
                    ? new Date(e.last_inspected_at).toLocaleDateString("ko-KR")
                    : "이력 없음"}
                </TableCell>
                <TableCell className="text-right">
                  <AdminInspectDialog extinguisher={e} />
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground text-center">
                검색 결과가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

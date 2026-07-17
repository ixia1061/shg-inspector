import Link from "next/link";

import { SiteFormDialog } from "@/components/admin/SiteFormDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUserRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminRole } from "@/lib/utils/roles";

export default async function SitesPage() {
  const supabase = await createClient();
  const [{ data: sites }, role] = await Promise.all([
    supabase.from("sites").select("*").order("name"),
    getCurrentUserRole(),
  ]);
  const canManageSites = isSuperAdminRole(role);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">사업장 관리</h1>
        {canManageSites ? (
          <SiteFormDialog />
        ) : (
          <p className="text-muted-foreground text-sm">사업장 등록은 시스템관리자만 가능합니다.</p>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>코드</TableHead>
            <TableHead>사업장명</TableHead>
            <TableHead>주소</TableHead>
            <TableHead>담당자</TableHead>
            <TableHead>연락처</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites?.length ? (
            sites.map((site) => (
              <TableRow key={site.id}>
                <TableCell className="text-muted-foreground">{site.org_code}</TableCell>
                <TableCell>
                  <Link href={`/sites/${site.id}`} className="font-medium hover:underline">
                    {site.name}
                  </Link>
                </TableCell>
                <TableCell>{site.address ?? "-"}</TableCell>
                <TableCell>{site.manager_name ?? "-"}</TableCell>
                <TableCell>{site.manager_phone ?? "-"}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                등록된 사업장이 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { UserRow } from "@/components/admin/UserRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: sites }, { data: userSites }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("sites").select("*").order("name"),
    supabase.from("user_sites").select("user_id, site_id"),
  ]);

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));
  const siteNamesByUser = (userSites ?? []).reduce<Record<string, string[]>>((acc, us) => {
    const name = siteNameById.get(us.site_id);
    if (name) (acc[us.user_id] ??= []).push(name);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <CreateUserDialog sites={sites ?? []} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>담당 사업장</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles?.length ? (
            profiles.map((p) => (
              <UserRow
                key={p.id}
                id={p.id}
                name={p.name}
                role={p.role}
                isActive={p.is_active}
                siteNames={siteNamesByUser[p.id] ?? []}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                등록된 사용자가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

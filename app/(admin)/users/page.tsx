import { redirect } from "next/navigation";

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

  // 사용자 관리는 시스템관리자 전용
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  if (me?.role !== "super_admin") {
    redirect("/dashboard");
  }

  const [{ data: profiles }, { data: sites }, { data: parts }, { data: userSites }, { data: userParts }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("sites").select("*").order("name"),
      supabase.from("management_parts").select("*").order("order_index"),
      supabase.from("user_sites").select("user_id, site_id"),
      supabase.from("user_parts").select("user_id, part_id"),
    ]);

  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));
  const partById = new Map((parts ?? []).map((p) => [p.id, p]));

  // 사업장 "전체" 배정
  const siteIdsByUser = (userSites ?? []).reduce<Record<string, string[]>>((acc, us) => {
    (acc[us.user_id] ??= []).push(us.site_id);
    return acc;
  }, {});
  // 특정 파트 배정
  const partIdsByUser = (userParts ?? []).reduce<Record<string, string[]>>((acc, up) => {
    (acc[up.user_id] ??= []).push(up.part_id);
    return acc;
  }, {});

  // 화면 표기: "무안공항 전체", "상주업체 기상(기상)" 등
  function scopeLabelsFor(userId: string): string[] {
    const labels: string[] = [];
    for (const siteId of siteIdsByUser[userId] ?? []) {
      labels.push(`${siteNameById.get(siteId) ?? "?"} 전체`);
    }
    for (const partId of partIdsByUser[userId] ?? []) {
      const part = partById.get(partId);
      if (part) labels.push(`${siteNameById.get(part.site_id) ?? "?"} ${part.name}`);
    }
    return labels;
  }

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
                scopeLabels={scopeLabelsFor(p.id)}
                sites={sites ?? []}
                parts={parts ?? []}
                assignedSiteIds={siteIdsByUser[p.id] ?? []}
                assignedPartIds={partIdsByUser[p.id] ?? []}
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

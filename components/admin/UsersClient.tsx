"use client";

import { useMemo, useState } from "react";

import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { PendingSignupRow } from "@/components/admin/PendingSignupRow";
import { ALL_SITES, SiteFilterButtons } from "@/components/admin/SiteFilterButtons";
import { UserRow } from "@/components/admin/UserRow";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { partsForSite } from "@/lib/utils/part";
import type { ManagementPart, Site, UserRole } from "@/types/domain";

export interface UserListItem {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  scopeLabels: string[];
  assignedSiteIds: string[];
  assignedPartIds: string[];
  /** 배정으로 계산한 소속 사업장(사업장 필터용). 비어 있으면 미배정. */
  siteIds: string[];
}

/**
 * 사업장 필터. 아직 아무 데도 배정되지 않은 사용자는 어느 필터에서도 보이게 둔다 —
 * 사업장으로 가릴 근거가 없고, 가려버리면 배정해 줄 방법이 사라진다.
 */
function filterUsers(rows: UserListItem[], siteId: string): UserListItem[] {
  if (siteId === ALL_SITES) return rows;
  return rows.filter((u) => u.siteIds.length === 0 || u.siteIds.includes(siteId));
}

export interface PendingSignupItem {
  id: string;
  name: string;
  email: string | null;
  siteId: string;
  siteName: string;
  requestedAt: string;
}

/**
 * 사용자 관리 — 역할에 따라 보이는 범위가 다르다.
 * - 시스템관리자: 전체. 사업장 버튼으로 나눠 보고 관리자·점검자를 구분해 표시한다.
 * - 일반 관리자: 자기 담당 사업장의 점검자만. 점검자 생성과 가입 승인까지 할 수 있다.
 */
export function UsersClient({
  isSuper,
  sites,
  parts,
  grantableParts,
  admins,
  inspectors,
  pending,
}: {
  isSuper: boolean;
  /** 사업장 필터 버튼에 쓸 사업장(관리자는 담당 사업장만) */
  sites: Site[];
  /** 배정 다이얼로그용 전체 관리파트(시스템관리자 전용 UI에서 사용) */
  parts: ManagementPart[];
  /** 내가 부여할 수 있는 관리파트(점검자 생성·가입 승인에 사용) */
  grantableParts: ManagementPart[];
  admins: UserListItem[];
  inspectors: UserListItem[];
  pending: PendingSignupItem[];
}) {
  const [siteId, setSiteId] = useState(sites.length > 1 ? ALL_SITES : (sites[0]?.id ?? ALL_SITES));

  // 점검 범위를 바꿀 때 고를 수 있는 사업장 = 내가 부여 가능한 파트가 있는 사업장
  const grantableSites = useMemo(() => {
    const ids = new Set(grantableParts.map((p) => p.site_id));
    return sites.filter((s) => ids.has(s.id));
  }, [grantableParts, sites]);

  const visibleAdmins = useMemo(() => filterUsers(admins, siteId), [admins, siteId]);
  const visibleInspectors = useMemo(() => filterUsers(inspectors, siteId), [inspectors, siteId]);
  const visiblePending = useMemo(
    () => (siteId === ALL_SITES ? pending : pending.filter((p) => p.siteId === siteId)),
    [pending, siteId]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <CreateUserDialog isSuper={isSuper} sites={sites} parts={grantableParts} />
      </div>

      {sites.length > 1 && (
        <SiteFilterButtons sites={sites} value={siteId} onChange={setSiteId} />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">가입 승인 대기 ({visiblePending.length})</h2>
        {visiblePending.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>신청 사업장</TableHead>
                <TableHead>신청일</TableHead>
                <TableHead>처리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiblePending.map((p) => (
                <PendingSignupRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  email={p.email}
                  siteName={p.siteName}
                  requestedAt={p.requestedAt}
                  parts={partsForSite(grantableParts, p.siteId)}
                />
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">대기 중인 가입 신청이 없습니다.</p>
        )}
      </section>

      {isSuper && (
        <UserSection
          title={`관리자 (${visibleAdmins.length})`}
          rows={visibleAdmins}
          sites={sites}
          parts={parts}
          grantableSites={grantableSites}
          canManage
          canToggleActive
          canDelete
        />
      )}

      {/* 관리자도 자기 범위 점검자는 범위 변경·활성/비활성·삭제를 바로 할 수 있다.
          (점검 이력이 있는 계정은 서버에서 삭제를 막고 비활성을 안내한다) */}
      <UserSection
        title={`점검자 (${visibleInspectors.length})`}
        rows={visibleInspectors}
        sites={sites}
        parts={parts}
        grantableSites={grantableSites}
        canManage={isSuper}
        canToggleActive
        canDelete
      />
    </div>
  );
}

function UserSection({
  title,
  rows,
  sites,
  parts,
  grantableSites,
  canManage,
  canToggleActive,
  canDelete,
}: {
  title: string;
  rows: UserListItem[];
  sites: Site[];
  parts: ManagementPart[];
  /** 범위 변경 다이얼로그에 보일 사업장(내가 부여할 수 있는 곳) */
  grantableSites: Site[];
  /** 역할 변경·배정·삭제 가능 여부(시스템관리자만) */
  canManage: boolean;
  /** 활성/비활성 토글 가능 여부 */
  canToggleActive: boolean;
  /** 계정 삭제 가능 여부 */
  canDelete: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>담당 범위</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((u) => (
              <UserRow
                key={u.id}
                id={u.id}
                name={u.name}
                email={u.email}
                role={u.role}
                isActive={u.isActive}
                scopeLabels={u.scopeLabels}
                sites={sites}
                parts={parts}
                assignedSiteIds={u.assignedSiteIds}
                assignedPartIds={u.assignedPartIds}
                scopeSiteIds={u.siteIds}
                grantableSites={grantableSites}
                canManage={canManage}
                canToggleActive={canToggleActive}
                canDelete={canDelete}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground text-center">
                해당하는 사용자가 없습니다.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}

@AGENTS.md

# 소화기 점검 관리 시스템 — 프로젝트 지침 (CLAUDE.md)

> **유지보수 규칙:** 기능을 추가·수정할 때마다 이 문서의 관련 섹션과 아래
> [변경 이력](#변경-이력-changelog)·[TODO](#앞으로-구현할-기능-todo)를 **함께 갱신한다.**

---

## 프로젝트 개요

무안국제공항의 소화기를 QR 코드 기반으로 점검·관리하는 모바일 우선 PWA. 점검자는 소화기에
부착된 QR을 스캔해 20~30초 안에 점검을 기록하고, 관리자는 미점검 현황과 내용연수 만료를
한눈에 파악한다. 인터넷이 없는 현장(지하 등)에서도 오프라인 점검이 가능하고, 온라인 복귀 시
자동 동기화된다. 단일 테넌트(하나의 조직) 구성.

## 프로젝트 목적

- **점검 속도**: 현장에서 QR 스캔 → 체크리스트 → 완료까지 20~30초.
- **누락 방지**: 관리자가 월 1회 점검 기준으로 미점검·이상 소화기를 즉시 파악.
- **생애주기 관리**: 제조일·내용연수 기반으로 교체 예정/만료를 자동 계산.
- **현장 신뢰성**: 오프라인 점검 + 자동 동기화로 점검 데이터 유실 방지.
- **감사 무결성**: 점검 기록은 append-only(수정/삭제 불가), 정정은 새 점검으로.

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | **Next.js 16.2.10** (App Router) — 프로덕션 빌드는 `next build --webpack` |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS v4 |
| UI | shadcn/ui (**Base UI** 기반 `base-nova` 스타일) |
| 백엔드 | **Supabase** (PostgreSQL / Auth / Storage) |
| 폼/검증 | React Hook Form + Zod |
| QR | html5-qrcode (스캔), qrcode (라벨 생성) |
| 오프라인 | Dexie (IndexedDB) — Outbox 큐 + 소화기 캐시 |
| PWA | Serwist (서비스워커) |
| 기타 | jszip (사진 ZIP), lucide-react, sonner, next-themes |
| 호스팅 | Vercel (GitHub 연동 자동 배포) |

## 폴더 구조

```
app/
  (auth)/login/            로그인
  (admin)/                 관리자 (사이드바 레이아웃, role=admin/super_admin 가드)
    dashboard/             대시보드 (월간 점검 집계)
    sites/[siteId]/        사업장·관리파트·건물·층·구역·차량 관리
    extinguishers/         소화기 목록/등록/상세/라벨
    labels/                QR Code 관리 (검색·다중선택·일괄 인쇄, force-dynamic)
    inventory/             수량 현황 (건물×종류 교차표)
    inspections/           전체 점검현황
    lifecycle/             내용연수 관리
    photos/                점검 사진 관리 (조회·삭제·ZIP 다운로드)
    stats/                 통계
    assignments/           점검자 배정 (관리자가 자기 파트를 점검자에게 부여)
    users/                 사용자 관리 (시스템관리자 전용, 사업장 전체/파트 배정)
  (inspector)/             점검자 (모바일 레이아웃)
    scan/                  QR 스캐너 (첫 화면)
    inspect/[assetCode]/   점검 체크리스트 (QR 스캔 통과 필요)
    status/[buildingId]/   건물별 점검현황 드릴다운
  account/                 내 계정 (비밀번호 변경)
  actions/                 서버 액션 (photoActions 등)
  api/photos/download/     사진 ZIP 다운로드 (관리자)
  api/ledger/download/     소화기 관리대장 Excel(.xlsx) 다운로드 (관리자)
  page.tsx                 루트 — 역할별 홈으로 리다이렉트
  manifest.ts, sw.ts       PWA
components/
  ui/                      shadcn/Base UI 원자 컴포넌트
  admin/                   관리자 화면 컴포넌트 (AdminSidebar, AdminMobileNav, FloorList, *FormDialog 등)
  inspector/               점검자 컴포넌트 (QRScanner, InspectionChecklist, SyncStatusBanner 등)
  shared/                  공용 (LoginForm, SignOutButton, DateInput 등)
lib/
  supabase/                client.ts(브라우저), server.ts(RSC), admin.ts(service_role, server-only), middleware.ts
  offline/                 db.ts(Dexie), outbox.ts, syncEngine.ts, prewarm.ts
  utils/                   roles.ts, lifecycle.ts, location.ts, watermark.ts, scanPass.ts, supabaseError.ts
  validations/             *.schema.ts (Zod)
hooks/                     useOnlineStatus, useOfflineQueue, useExtinguisherLookup
types/                     database.types.ts(수기 작성), domain.ts
supabase/migrations/       스키마 마이그레이션 (타임스탬프 순)
proxy.ts                   미들웨어 (Next.js 16: middleware.ts → proxy.ts) — 인증 세션 갱신/가드
next.config.ts             Serwist는 프로덕션 빌드에서만 래핑
```

## 데이터베이스 구조

핵심 테이블 (자세한 정의는 `supabase/migrations/` 참고):

| 테이블 | 요약 |
|---|---|
| `profiles` | auth.users 확장. `role`(super_admin/admin/inspector), `is_active`, `name` |
| `user_sites` | 사용자–**사업장 전체** 배정 (그 사업장의 현재·미래 모든 파트 접근) |
| `user_parts` | 사용자–**특정 관리파트** 배정 (그 파트만 접근). 관리자가 점검자에게 부여 가능 |
| `user_site_order` | 관리자 **개인별** 사업장 표시 순서(점검현황·수량현황 상단 버튼). `site_order`(site_id 배열), 본인 행만 RLS로 조작 가능 |
| `sites` | 사업장. `org_code`(nullable, **레거시**: 관리번호 prefix는 이제 `management_parts`로 이전) |
| `management_parts` | **관리파트**. `site_id`, `code`(관리번호 앞자리, **전체 유일**), `name`, `order_index`. 사업장 하위, 소화기 등록 시 선택 |
| `buildings` | 건물. `site_id`, `building_no`. **파트 공용** |
| `floors` | 층. `building_id`, `floor_code`, `order_index`. **파트 공용** |
| `zones` | 구역(선택). `floor_id` |
| `vehicles` | 차량. **건물 소속**(`building_id`), `plate_no`(번호판) |
| `extinguisher_types` | 소화기 종류. `default_useful_life_years`(nullable — CO2/할론 등 내용연수 없음) |
| `extinguishers` | 소화기. `location_type`(BUILDING/VEHICLE), **`part_id`**(관리파트 → 관리번호 prefix), `asset_code`(UNIQUE, 자동생성), `manufacture_date`, `useful_life_years`(nullable), `status` |
| `asset_code_history` | 관리번호 변경 이력 (QR 재발급 없이 옛 코드→최신 소화기 연결) |
| `inspections` | 점검 기록. **append-only**. `inspector_id`, 체크항목 7개(점검사항 6개 + `etc_ok`), `overall_result`, `inspected_at`. 구 항목 4개(`pressure_ok`·`seal_ok`·`appearance_ok`·`installation_ok`)는 2026-07-27 이전 기록 보존용(nullable) |
| `inspection_photos` | 점검 사진 메타. 소화기당 최신 5장만 유지 |
| `inspection_actions` | 이상 점검 조치 기록(append). `inspection_id`(UNIQUE), `action_note`(조치내용), `resolved_by`, `resolved_at`. 관리자 전용. 조치완료해야 이번달 점검완료로 집계 |

**주요 뷰/함수**
- `v_extinguisher_overview` — 소화기 + 최근 점검 + 계산된 상태 + 전체 위치경로. 목록/대시보드 대부분이 이걸 사용.
- `fn_dashboard_summary()` — 대시보드 집계(이번달 점검/미점검/교체예정/만료/최근 이상).
- `fn_inspection_rate()` — 점검률 통계.
- `fn_submit_inspection(jsonb)` — 점검+사진 원자적 저장 (온라인/오프라인 동기화 공용).
- `fn_find_extinguisher_id_by_code(text)` — 관리번호(현재/과거)로 소화기 id 조회.
- `fn_extinguisher_status`, `fn_kst_today()` — 내용연수 상태(KST 기준) 계산.
- `is_admin()`, `is_super_admin()`, `has_site_access()`, `has_part_access()`, `fn_extinguisher_part_id()` — RLS 보안 정의자 헬퍼. **소화기·점검은 파트 스코프(`has_part_access`), 건물/층 등 구조는 사업장 스코프(`has_site_access`).**

**날짜는 항상 KST(Asia/Seoul) 기준** — `fn_kst_today()`를 쓴다. (UTC로 계산하면 00:00~09:00 사이 하루 오차 발생.)

## QR 관리번호 규칙

- **건물 소화기**: `{관리파트코드}-{건물번호}-{층코드}-{소화기번호}` (예: `공사-1-1-1`, `소방-1-1-1`)
- **차량 소화기**: `{관리파트코드}-{건물번호}-차-{일련번호}` (예: `공사-1-차-1`) — 차량은 건물 소속, 층 대신 `차` 사용
- **prefix는 사업장이 아니라 `management_parts.code`**(2026-07-25 이전). 건물/층은 파트 공용이고, **파트가 다르면 소화기 번호는 1부터 독립 채번**(스코프 = 층+파트 / 건물+파트). `asset_code`는 **UNIQUE**.
- 소화기 등록 시 `part_id` 선택. **비우면 트리거가 사업장 기본 파트로 채움**(구버전 코드 전환 안전).
- 관리번호는 **트리거로 자동 생성**(`pg_advisory_xact_lock`으로 번호 채번 동시성 보장). **파트 코드 변경 시** 소속 소화기 관리번호를 연쇄 재계산(파트 이동도 동일).
- **QR은 재발급하지 않는다.** 위치 이동 등으로 관리번호가 바뀌면 옛 코드를 `asset_code_history`에 남겨 옛 QR도 최신 소화기로 연결.
- **층코드는 확장 가능**: 0=지하, R=옥상 등. `차`는 차량 전용 예약어(층 테이블에서 사용 금지).
- QR에는 `asset_code`(또는 `/inspect/{asset_code}` URL)를 인코딩한다.

## Supabase 구조

- **프로젝트 ref**: `zbdvuxzoahusdrpniuwz` / URL `https://zbdvuxzoahusdrpniuwz.supabase.co` (`.env.local`·Vercel이 가리키는 **실제 운영 DB**)
- **리전**: `ap-northeast-2`(서울) — 속도 개선 위해 뭄바이에서 이전 완료(2026-07). ⚠️ 옛 뭄바이 프로젝트 `nppqfmcrjvipjlcqjajv`(ap-south-1)는 **초기 MVP 시절 데이터만 있는 죽은 DB** — 마이그레이션/스크립트를 **절대 여기 적용하지 말 것**. 접속 대상은 항상 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` ref로 확인.
- **Auth**: 이메일/비밀번호, **공개 회원가입 없음**. 계정은 시스템관리자가 발급. `handle_new_user` 트리거가 가입 시 profile 자동 생성.
- **Storage**: `inspection-photos` 버킷(점검 사진). 경로에 소화기 id 포함, 소화기당 최신 5장 유지.
- **RLS**: 모든 테이블에 적용. `is_admin()`(admin+super_admin) / `is_super_admin()` / `has_site_access()` 보안 정의자 함수로 판별. `profiles`·`user_sites` 쓰기는 **시스템관리자만**(일반 관리자가 API로 자기 역할을 올리는 것 차단).
- **역할 체계 (3단계)**
  - `super_admin`(시스템관리자): 전체 권한. **사업장 등록·사용자 추가·역할 변경·담당 사업장 배정 독점**. 삭제·강등·비활성 불가(보호). 모든 사업장 접근.
  - `admin`(관리자): **배정된 담당 사업장 범위 내에서만** 건물/층/구역/차량/소화기·점검·대시보드·통계 관리. 사업장 등록/수정/삭제와 사용자 관리는 불가. QR 없이 목록에서 점검 가능(관리자 영역 모달).
  - `inspector`(점검자): 배정된 사업장만 조회. **QR 스캔을 통해서만** 점검. (관리자의 QR 없는 점검도 점검자에게 완료로 반영.)
  - **스코핑 원리**: `has_site_access(site) = is_super_admin() OR user_sites(site) OR user_parts 중 그 site 파트`. `has_part_access(part) = is_super_admin() OR user_sites(part.site) OR user_parts(part)`. 소화기/점검 RLS는 `has_part_access(part_id)`, 건물/층 등 구조는 `has_site_access`. 뷰/RPC가 모두 `security invoker`라 자동 한정. **파트 배정(user_parts)이 없으면 user_sites로 귀결돼 사업장 단위와 동일.**
  - **권한 배정**: 시스템관리자는 사용자에게 **사업장 전체(user_sites) 또는 특정 파트(user_parts)** 배정(사용자 관리). 관리자는 **자기 맡은 파트**를 점검자에게 부여(`/assignments`, RLS로 경계 강제).
- **직접 DB 접속**(마이그레이션/스크립트): 직접 호스트는 IPv6 전용이라 접속 불가할 수 있음 → **Session Pooler**(`aws-1-ap-northeast-2.pooler.supabase.com:5432`, user `postgres.zbdvuxzoahusdrpniuwz`, database `postgres`, `ssl.rejectUnauthorized=false`) 사용. DDL(테이블/뷰/함수 생성)은 service_role(REST)로는 불가 → 반드시 이 pooler로 접속. DB 비밀번호는 문서에 적지 않음(사용 시 사용자에게 요청).

## Vercel 배포 정보

- **프로젝트**: `shg-inspector` (GitHub `ixia1061/shg-inspector` 연동)
- **프로덕션**: `main` 브랜치 → `https://shg-inspector.vercel.app`
- **프리뷰**: `develop`·`feature/*` 브랜치 → 각 브랜치 프리뷰 URL (Vercel 로그인 보호됨)
- **빌드 명령**: 기본값 `npm run build` = `next build --webpack` (Serwist가 Turbopack 미지원이라 webpack 고정)
- **재배포 = git push** (해당 브랜치로). 환경 변수 변경 시에는 재배포해야 반영됨.
- 롤백: Vercel Deployments → Instant Rollback, 또는 `git revert`. 자세한 흐름은 [README 3장](README.md) 참고.

## 환경변수 설명

`.env.local`(로컬, git 제외) / Vercel Environment Variables(운영). 4개 모두 Production·Preview 스코프 필요.

| 변수 | 공개 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 | anon/publishable 키 (RLS로 보호되어 노출 안전) |
| `NEXT_PUBLIC_APP_URL` | 클라이언트 | QR 라벨에 인코딩할 절대 URL origin. 로컬=`http://localhost:3000`, 운영=배포 도메인 |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | 관리자 기능(사용자 생성, 사진 일괄 관리). **절대 클라이언트/깃 노출 금지** — `lib/supabase/admin.ts`가 `server-only`로 보호 |

> `NEXT_PUBLIC_` 접두사 변수만 브라우저 번들에 포함된다. service_role 키는 서버 액션/라우트 핸들러에서만 사용.
> 시크릿 값(service_role 키, DB 비밀번호, 계정 비밀번호)은 이 문서에 적지 않는다.

## 개발 규칙

- **브랜치 전략**: `main`(운영) / `develop`(개발 통합) / `feature/*`·`fix/*`·`hotfix/*`. `main` 직접 push 금지, `develop` 거쳐 병합. 상세는 [README 3장](README.md).
- **커밋 메시지 접두사**: `feat:` `fix:` `docs:` `chore:` `perf:`.
- **빌드는 webpack**: 프로덕션은 반드시 `next build --webpack`. 개발(`next dev`)은 Serwist 래핑을 건너뜀(next.config.ts).
- **Next.js 16 주의**: 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드 확인(@AGENTS.md). `middleware.ts`→`proxy.ts`, 라우트 파라미터가 percent-encoding될 수 있음(한글 관리번호), LAN/터널 접속 시 `allowedDevOrigins` 필요.
- **DB 마이그레이션**: 기존 파일 수정 금지, 항상 `YYYYMMDDHHMMSS_설명.sql` 새 파일로 추가. 코드 배포와 별개로 DB에도 적용.
- **비밀 파일 금지**: `.env.local`, `recovery-codes.txt` 등 커밋 금지(.gitignore 확인). 시크릿이 담긴 임시 스크립트는 사용 후 즉시 삭제.
- **RLS 우선**: 단순 CRUD는 RLS로 보호하고 클라이언트에서 직접 호출. 복잡/권한 민감 로직만 서버 액션 + service_role.
- **UI 문구는 전부 한국어.**

## 코딩 스타일

- 주변 코드의 컨벤션(네이밍·주석 밀도·관용구)을 따른다. 주석은 한국어로, 꼭 필요한 곳에만.
- **Base UI 패턴**: `asChild` 대신 `render={<Component/>}` 프로프. Button이 Link를 렌더하면 `nativeButton={false}`. Select는 트리거 라벨을 위해 `items` 프로프(`{value,label}[]`) 필요. 폼은 `field.tsx`(구 form.tsx 아님).
- **역할 판별은 헬퍼 사용**: `isAdminRole()`/`isSuperAdminRole()`(`lib/utils/roles.ts`). `role === "admin"` 직접 비교 지양(super_admin 누락).
- **날짜는 KST**: 서버 계산은 `fn_kst_today()`, 표시는 `toLocaleDateString("ko-KR")`.
- **오프라인 우선 조회**: 점검 관련 조회는 캐시(IndexedDB) 우선 + 백그라운드 갱신(`useExtinguisherLookup`, `prewarm`).
- **서버 액션**: `"use server"` 파일에는 상수 export 금지(함수만). service_role 클라이언트는 서버에서만.
- 타입: `types/database.types.ts`는 수기 관리(supabase-js용 `Relationships: []` 유지). 도메인 alias는 `types/domain.ts`.
- 변경 후 `npx tsc --noEmit`와 `npm run build`로 검증.

## 앞으로 구현할 기능 (TODO)

- [x] ~~**Supabase 리전 이전** (뭄바이 ap-south-1 → 서울 ap-northeast-2)~~ — 완료(2026-07, 프로젝트 `zbdvuxzoahusdrpniuwz`).
- [ ] **비밀번호 찾기(재설정) 플로우** — 로그인 화면에 "비밀번호를 잊으셨나요?" + 이메일 재설정. (현재는 시스템관리자/Supabase 대시보드로만 복구 가능)
- [ ] **Zebra 라벨 프린터 연동** — BrowserPrint(ZPL) 직접 출력 + PDF 폴백. (`app/api/labels` 자리 마련됨)
- [ ] **알림** — 미점검/만료 임박 이메일·푸시 (pg_cron + Edge Function). MVP 제외 항목.
- [ ] **점검 이력/통계 내보내기** (Excel/PDF).
- [ ] **네이티브 앱 전환 검토** (Capacitor) — iOS 카메라/딥링크 제약이 커질 경우.

## 변경 이력 (Changelog)

> 형식: `YYYY-MM-DD — 요약`. 기능 추가·수정 시 최신 항목을 위에 추가한다.

- **2026-07-27** — **버그: 내 계정에서 바꾼 사업장 표시 순서가 다른 화면에 즉시 반영되지 않음.** 제보: `/account`에서 ▲▼로 순서를 바꾸고 뒤로 갔는데 점검현황·대시보드의 사업장 버튼이 그대로였고, **로그아웃 후 재접속하면 그제서야** 적용됨(저장 확인 표시도 없어 저장이 됐는지조차 알 수 없었음). 원인은 저장이 아니라 **클라이언트 라우터 캐시** — `SiteOrderEditor`가 upsert만 하고 `router.refresh()`를 호출하지 않는데(프로젝트의 다른 저장 컴포넌트는 전부 이 패턴을 따름), 순서를 쓰는 5개 페이지는 서버 컴포넌트이고 사이드바가 `<Link prefetch>`로 이동해 `next.config.ts`의 `staleTimes.static: 300` 때문에 **최대 5분간 캐시된 옛 RSC 페이로드**가 서버 왕복 없이 표시됨. **해결**: 저장 큐가 빈 뒤 `router.refresh()`를 1회 호출(연타해도 왕복 1회). Next 16 런타임에서 이 호출이 전역 세그먼트 캐시 버전을 올려(`segment-cache/cache.js`) **현재 라우트뿐 아니라 캐시된 다른 라우트까지** 무효화하고, `invalidateBfCache()`로 **브라우저 뒤로가기 경로**도 커버함을 확인. 소비 페이지에 `force-dynamic`을 붙이거나 `staleTimes`를 낮추는 방법은 평소 화면 전환 속도(2026-07-17 성능 개선)를 희생하므로 택하지 않음. 함께: **"저장 중… → 저장됨 ✓"** 상태 표시 추가(2초 후 사라짐, `aria-live`), 저장 실패 시 **마지막 저장 순서로 롤백**(기존엔 실패해도 화면만 바뀐 채 남음), upsert에 `updated_at` 명시(`default now()`는 INSERT에만 적용돼 갱신이 멈춰 있었음), 내 계정 설명 문구를 실제 적용 범위(대시보드·점검현황·수량현황·내용연수·통계)로 수정. 마이그레이션 불필요. `tsc --noEmit`·`next build --webpack` 통과, lint 신규 없음.
- **2026-07-27** — **대시보드·통계도 사업장별 전환식으로 변경(집계를 RPC → 클라이언트로).** 여러 사업장을 담당하는 관리자(소방대 관리자=4곳)에게 한 화면에 다 섞여 보여 복잡하다는 요청. 특히 **건물명 9종이 사업장끼리 중복**(관리동·동력동·여객청사(일반)·관제탑·소방대·정비고·장비차고·화물청사·여객청사(격리))이라 건물 35개가 가나다순으로 늘어선 점검률 차트에서 **어느 사업장 건물인지 구분이 불가능**했음(단순 복잡함이 아니라 오독 문제). **공용 `SiteFilterButtons`**(신규, `ALL_SITES` 상수) — 담당 사업장이 2곳 이상일 때만 **[전체]** 버튼을 노출하고 기본 선택은 첫 사업장, 순서는 `user_site_order`(개인 설정). 전체를 볼 때는 차트 라벨에 `사업장 · 건물명`을 붙여 중복 건물을 구분. 대시보드 버튼에는 사업장별 **이번달 미점검 수**를 배지로 표시. **집계 방식 변경**: `fn_dashboard_summary`·`fn_inspection_rate` RPC 호출을 없애고, 이미 조회하던 `v_extinguisher_overview` 한 벌로 클라이언트에서 계산(`lib/utils/dashboard.ts`의 `summarizeExtinguishers`·`buildingInspectionRates`, 판정은 기존 `isMonthDone`/`isActionNeeded` 재사용) → 사업장 전환에 서버 왕복 없음 + 대시보드 쿼리 3개→2개. `recent_abnormal`만 점검기록 기반이라 최근 30일 이상점검을 별도 조회해 소화기→사업장 매핑으로 집계. 통계의 **점검자별 실적**도 `inspections.extinguisher_id`를 소화기 사업장으로 매핑해 사업장별로 분리. **실데이터 대조 검증**: 전체 및 사업장 4곳의 7개 지표와 건물 34개 점검률이 기존 DB 함수 결과와 **전부 일치**. (신규 `DashboardClient`·`StatsClient`) `tsc --noEmit`·`next build --webpack`·lint 통과.
- **2026-07-27** — **소화기 관리·QR Code 관리에 관리파트 필터 추가 + 내용연수 위치 표기 통일.** 남부공항서비스 등록으로 관리파트가 13개까지 늘어 사업장 필터만으로는 목록이 너무 넓다는 요청 → 두 화면의 **사업장 필터와 상태 필터 사이에 "전체 관리파트" 드롭다운** 추가(`ExtinguisherListClient`·`QrBulkPrint`). 사업장을 고르면 **그 사업장의 파트만 선택지에 남고**, 사업장을 바꿔 현재 파트가 범위 밖이 되면 파트 선택을 자동 해제. 공용 유틸 `lib/utils/part.ts`(`formatPartLabel` — 이름과 코드가 다르면 `소방 (공사)`처럼 관리번호 앞자리 병기, `partsForSite`). 두 페이지가 `management_parts`를 함께 조회(RLS로 접근 가능한 파트만). 필터는 기존과 같이 **클라이언트에서 즉시 적용**(서버 왕복 없음). 부수: 내용연수 관리 목록의 위치 표기를 `formatLocationPath`(사업장 포함) → **`formatShortLocation`**(소화기 관리와 동일하게 사업장 생략, 건물>층>설치위치)으로 변경 — 사업장은 이미 상단 버튼으로 선택돼 있어 중복이었음. `tsc --noEmit`·`next build --webpack` 통과, lint 신규 없음.
- **2026-07-27** — **내용연수 관리를 사업장별 전환식으로 변경 + 개인별 순서 + 상태 우선 정렬.** 점검현황·수량현황과 동일하게 상단 **사업장 버튼**으로 전환하도록 `LifecycleClient`(신규) 도입, 버튼 순서는 `user_site_order`(관리자 개인 설정, `sortSitesByPreference`)를 따르고 버튼에 사업장별 교체대상 건수를 함께 표시. 정렬은 기존 "교체예정일 순"에서 **상태 우선(만료 → 30일 → 90일), 같은 상태 안에서는 관리번호 자연정렬**로 변경(`sortByLifecycleUrgency` in `lib/utils/sort.ts`) — 만료 목록이 날짜별로 흩어져 현장에서 관리번호 순으로 훑기 어렵다는 요청 반영(어제 넣은 "교체예정일 동률 시 관리번호" 2차 정렬을 대체). 교체 예정일은 목록 컬럼에 그대로 표시. 실데이터 검증(32대: 남부 10·상주 1·공사 21, 만료 그룹 내 `기계-6-1-9`→`6-1-10`→`14-1-18` 자연정렬 확인). `tsc --noEmit`·`next build --webpack` 통과.
- **2026-07-27** — **버그: 관리번호 변경이 RLS에 막혀 실패(시스템관리자 포함).** 제보: 사업장 전체 권한을 가진 소방대 관리자가 `보안-2-1-1`을 새로 만든 건물1 1층으로 옮겨 `보안-1-1-1`로 바꾸려 하니 "권한이 없다"는 메시지, **시스템관리자도 동일**. 원인: `asset_code_history`는 **SELECT 정책만 있고 INSERT 정책이 없는데**, 관리번호가 바뀔 때 옛 코드를 남기는 트리거 `fn_log_asset_code_change`가 **security invoker**라 RLS 적용을 받아 42501로 거부됨 — INSERT를 허용하는 정책이 하나도 없으니 `is_super_admin()`도 우회 불가(정책 부재는 전원 거부). 같은 계열 `fn_cascade_asset_code_from_part`는 이미 definer라 파트 코드 변경 캐스케이드는 정상 동작했고, 데이터 일괄 입력은 pooler(postgres)로 해서 RLS를 안 거쳐 그동안 드러나지 않았음. **해결**: 마이그레이션 `20260727150000_fix_asset_code_history_trigger.sql`로 이력 트리거를 **security definer**(+`set search_path=public`)로 변경. INSERT 정책을 여는 대신 트리거에만 권한을 준 이유는, 이 테이블이 앱이 직접 쓰지 않는 **감사 테이블**이라 정책을 열면 클라이언트가 임의 이력을 써넣을 수 있기 때문. **서울 운영 DB 적용 완료**, 계정별 재현 검증(시스템관리자·소방대 관리자=변경 성공 / 남부 관리자·점검자 전원=0행, 권한 경계 유지). 부수: `friendlyErrorMessage`의 42501 안내가 맥락과 무관하게 "점검할 권한이 없습니다"로 나가 원인 파악을 방해했던 것을 **막힌 테이블별로 분기**(inspections·inspection_photos면 점검 안내, 그 외는 일반 권한 안내)로 개선. `tsc --noEmit`·`next build --webpack` 통과.
- **2026-07-27** — **남부공항서비스 소화기 251개 입력**(데이터, `2026 남부공항서비스 소화기 관리대장 (수정파일).xlsx`). 사업장·관리파트 6개(전기·기계·통신·토목·조류·미화)는 기존에 있었고 소화기 0대 상태 → **건물 15개·층 28개·차량 16대·소화기 251대** 신규 생성. 파트별 내역: 기계 97·전기 79·토목 38·통신 29·미화 4·조류 4. **관리번호는 대장 원본 그대로**(`extinguisher_no` 명시 삽입) — 251개 전부 일치·제조일/제조번호 불일치 0건을 삽입 직후 검증(불일치 시 자동 롤백하도록 트랜잭션 구성, DRY RUN 리허설 후 커밋). 종류 매핑: 축압식→분말소화기(10년), CO2→이산화탄소소화기, 청정소화기, 간이소화기 400g, N2 축압식→N2소화기(용량 대문자 `Kg`는 기존 표기 `kg`로 통일). 층코드 0=지하·1~4·8(관제탑 8층)·차(차량 19대/실차 16대, 한 차량에 2대 배치 3건). 등록 직후 상태: 내용연수 만료 8·30일내 2·정상 117·해당없음 124. **전체 시스템 소화기 499→750대.** 사전 검토에서 지적한 4건(건물1 일반/격리 → 건물1·2 분리, `축압식 3.4kg`→3.3kg 오타, `청정소화기 400g`→`간이소화기 400g`, 채번 비연속 해소)은 사용자가 엑셀에서 수정 완료. **남은 실물 확인 2건**: 제조번호 중복 `167469`(토목-13-1-2/7)·`166206`(토목-13-1-5/6). 임시 Node 스크립트로 수행 후 삭제, 저장소 변경 없음(데이터라 재배포 불필요).
- **2026-07-27** — **관리대장: 조치완료 시 점검사항 X → O 표기 + 매뉴얼 최신화.** 아래 항목으로 대장에 점검사항 O/X가 들어간 뒤, **관리자가 조치를 완료한 소화기는 불량이 해소된 상태이므로 X를 그대로 두면 안 된다**는 요청 → `checkMark(ok, resolved)`가 `last_action_resolved_at`이 있으면 X도 O로 표기(값이 없는 항목은 계속 빈칸). 무엇이 불량이었는지는 **불량항목·불량내용·조치내용** 컬럼에 그대로 남아 이력 추적 가능. 매뉴얼(`manual/`)도 함께 갱신: 사용자매뉴얼·`매뉴얼.html`의 점검 항목 표를 **6개+기타사항**과 각 항목 확인 요령(약제방출=방출 흔적, 약제응고=흔들어 굳음 확인, 게이지=바늘 초록 범위, 손잡이=손잡이·안전핀·봉인줄, 호스=균열·막힘, 호스걸이=거치 상태)으로 교체, 관리자매뉴얼에 대장 점검사항 O/X·조치완료 시 O 전환 설명 추가, 테스트체크리스트에 검증 항목 2개 추가, 스크린샷목록 문구 수정, 작성일 2026-07-27로 통일. `manual/소화기점검_매뉴얼.pdf` 헤드리스 Chrome으로 재생성(9p→10p). `tsc --noEmit`·`next build --webpack` 통과.
- **2026-07-27** — **점검 체크항목을 실제 관리대장 양식(점검사항 6개)으로 교체 + 관리대장에 O/X 컬럼 추가.** 현장에서 쓰던 기존 종이 관리대장의 점검사항이 **약제방출·약제응고·게이지상태·손잡이상태·호스상태·호스걸이** 6개인데 앱은 압력/봉인/외관/설치 4개(+기타)라 대장과 항목이 맞지 않았음. 앱 체크항목을 이 **6개 + 기존 "기타사항 정상"**(불량 시 아래 이상 내용에 수기 기입, 방식 그대로 유지) = **7개**로 교체. 관리대장 점검대장 시트에 **내용연수상태와 최근점검일 사이**로 점검사항 6개 컬럼을 넣고 **체크 유지=O / 체크 해제=X / 값 없음(미점검·구버전 점검)=빈칸**으로 표기. 신규 마이그레이션 `20260727090000_inspection_items_v2.sql`: `inspections`에 6개 컬럼(nullable) 추가, 구 4개 컬럼은 **과거 기록 보존을 위해 남기고 not null만 해제**(신규 점검은 null → 불량항목·대장에서 자동 제외), `fn_submit_inspection`·`v_extinguisher_overview`(`last_*` 6개 노출) 갱신. 체크항목 정의를 `lib/utils/inspection.ts`의 `LEDGER_CHECK_ITEMS`(대장 6개)·`INSPECTION_CHECK_ITEMS`(6개+기타)로 **한 곳에 모아** 점검 화면 2곳(`InspectionChecklist`·`AdminInspectDialog`)·`computeOverallResult`·불량항목 표기·대장 컬럼이 모두 이 배열을 따르게 함(항목 추가·순서 변경이 한 파일로 끝남). 오프라인 Outbox(`OutboxInspection`)도 신규 필드로 교체하되, 구버전 앱이 쌓아둔 큐 항목은 `syncEngine`이 옛 항목까지 함께 실어 보내 유실 없이 동기화. 도움말(`/help`) 점검 항목 문구 갱신. `tsc --noEmit`·`next build --webpack` 통과, lint 신규 오류 없음.
- **2026-07-26** — **점검현황·수량현황 사업장 버튼 순서를 관리자 개인별로 설정 가능하게 추가.** 요청: 관리자 계정마다 원하는 사업장 순서가 다를 수 있음(예: A 관리자는 상주업체를 먼저, B 관리자는 한국공항공사를 먼저) — 전체 공통 순서가 아니라 계정별 개인 설정으로 구현. **신규 테이블** `user_site_order`(`site_order` jsonb 배열, `user_id` PK, RLS `user_id = auth.uid()`로 본인 행만 조작 — `profiles` 쓰기가 시스템관리자 전용이라 그 경계를 안 건드리려고 별도 테이블로 분리, `user_sites`/`user_parts`와 같은 패턴). **내 계정**(`/account`) 화면에 관리자에게만 보이는 **"사업장 표시 순서"** 섹션 추가(`SiteOrderEditor`, `FloorList`의 "선택 후 고정 ▲▼로 이동" UI 재사용, 이동마다 `user_site_order` upsert). `lib/utils/sort.ts`에 `sortSitesByPreference` 추가(설정 없는 사업장은 기존 순서 유지한 채 뒤로, 안정 정렬). `app/(admin)/inspections/page.tsx`·`app/(admin)/inventory/page.tsx`가 로그인한 관리자의 `user_site_order`를 조회해 사업장 버튼 순서에 반영. 마이그레이션 `20260726140000_user_site_order.sql`, **서울 운영 DB 적용 완료**. `tsc --noEmit`·`next build --webpack`·lint 통과.

- **2026-07-26** — **내용연수 관리 2차 정렬(교체예정일 동률 시 관리번호 자연정렬) 추가.** 기존엔 `.order("replace_due_date")`만 걸려 있어 교체예정일이 같은 소화기끼리는 순서가 불규칙(DB 반환 순서 의존)했음. `app/(admin)/lifecycle/page.tsx`에서 조회 후 JS로 재정렬: 1차 교체예정일 오름차순, 동률이면 `compareAssetCode`(`lib/utils/sort.ts`, `localeCompare` numeric)로 관리번호를 가나다+숫자 순번대로 정렬(`공사-1-1-10`이 `...-2`보다 앞서는 문제 방지). `tsc --noEmit`·`next build --webpack`·lint 통과.
- **2026-07-26** — **버그: 점검 저장 실패 시 "[object Object]" 문구 수정.** 제보: 관리파트 배정이 없는 점검자가 점검완료를 누르면(RLS가 정상적으로 저장을 거부) 오류 문구가 "점검 저장에 실패했습니다 [object Object]"로 떠서 원인을 알 수 없었음. 원인: Supabase 에러(PostgrestError)는 `Error` 인스턴스가 아닌 일반 객체라 `err instanceof Error ? err.message : String(err)` 패턴에서 `String(err)`가 "[object Object]"를 반환. `lib/utils/supabaseError.ts`의 `friendlyErrorMessage`(기존엔 관리자 폼에서만 사용, 유니크/외래키 제약만 처리)를 **`unknown` 입력을 받도록 확장**하고 **RLS 위반(42501) 케이스**를 추가해 "이 소화기를 점검할 권한이 없습니다. 관리자에게 관리파트 배정을 요청하세요."로 안내. 이 유틸을 안 쓰고 있던 `InspectionChecklist.tsx`(점검자 점검 화면)·`AdminInspectDialog.tsx`(관리자 직접 점검)·`lib/offline/syncEngine.ts`(오프라인 동기화 실패 사유 저장)에 적용. `tsc --noEmit`·`next build --webpack`·lint 통과(기존 무관 경고 14건 외 신규 없음).
- **2026-07-26** — **한국공항보안(항공보안파트너스) 소화기 17개 입력**(데이터, `2025 항공보안파트너스 소화기 관리대장.xlsx`). 사업장명 오타 "항국공항보안"을 사용자가 직접 "한국공항보안"으로 정정 후 진행. 건물 4개(2동 여객청사(격리)·3동 관리동·5동 동력동·9동 레이더실) + 층 5개(2동만 1·2층, 나머지 1층) 신규 생성, 소화기 17개(전부 분말소화기 3.3kg) 등록 — 기존 "보안" 파트(코드 `보안`) 사용. **관리번호는 엑셀 원본 그대로 건물번호 2·3·5·9를 유지**(트리거 자동채번을 엑셀과 동일한 순서로 삽입해 재현) — 이미 부착된 QR 라벨과 관리번호가 일치하도록 하기 위함(재발급 불필요). 표지 보유현황 합계(17)와 대장 실데이터(17건)가 정확히 일치함을 사전 확인, 삽입 후 관리번호 17개 전부·제조일(텍스트 캐스팅으로 재확인) 검증 완료. 임시 Node 스크립트(pooler 직접 접속, 트랜잭션 + 관리번호 불일치 시 자동 롤백)로 수행 후 즉시 삭제, 저장소 변경 없음(데이터라 재배포 불필요).
- **2026-07-26** — **점검자 배정 화면: 담당 범위 밖 점검자를 목록에서 숨김(교차 노출 방지).** 제보: 남부공항서비스만 담당하는 "남부 관리자"가 `/점검자 배정`을 열면 한국공항공사 소속 점검자(A~D조)까지 보이고 권한을 줄 수 있었음 — 점검자 목록이 관리자 범위와 무관하게 전체 조회였기 때문(버그). **개선**: `assignments/page.tsx`에서 각 점검자의 기존 배정(user_sites+user_parts→사업장 매핑)이 **관리자 자신의 담당 범위와 하나도 안 겹치면 목록에서 제외**, 아직 아무 데도 배정 안 된 신규 점검자는 누구나 볼 수 있게 유지(첫 배정 가능). 시스템관리자는 그대로 전체를 봄. 이 판단을 위해 **신규 마이그레이션** `20260726130000_user_sites_admin_read_all_inspectors.sql`: 어제 추가한 범위 한정 조회 정책(`user_sites_select_admin_scoped`)으로는 범위 밖 배정이 아예 안 보여 "미배정처럼" 오인되는 문제가 있어, `user_parts`(이미 전량 관리자 열람 허용)와 동일하게 **점검자 대상 `user_sites` 행은 모든 관리자가 열람 가능**하도록 넓힘(쓰기는 여전히 시스템관리자 전용 — 실제 권한 경계는 쓰기 정책이 담당, 열람 범위만 확장). **서울 운영 DB 적용 완료**, 실데이터로 검증(남부 관리자=남부공항서비스만/소방대 관리자=4개 사업장 전체 배정 확인 → 필터링 결과가 의도와 일치). `tsc --noEmit`·`next build --webpack` 통과.
- **2026-07-26** — **점검자 배정 화면을 파트 단위 → 사업장 단위 체크로 재설계.** 직전 개선(아래 항목)의 "사업장 버튼 전환식"도 파트가 많은 사업장(남부공항서비스 6개 등)에서는 여전히 파트 하나하나를 확인해야 해 번거롭다는 피드백 → 체크 단위 자체를 사업장으로 낮춤. 사업장 칸 하나를 체크하면 **그 사업장에 속한(내가 부여 가능한) 관리파트 전체가 한 번에 `user_parts`로 부여**된다(실제 DB는 여전히 파트 단위 기록이라 관리자 경계 `has_part_access`를 벗어나지 않음 — "진짜 사업장 전체"인 `user_sites`는 여전히 시스템관리자 전용으로 별도 유지). 셀 상태 3가지: **전체 배정됨**(초록 배지, `user_sites`로 이미 전체 권한 — 토글 불가) / **체크**(그 사업장 파트 전체 부여됨) / **일부**(주황 indeterminate — 과거 파트별로 낱개 부여했던 경우, 클릭 시 나머지도 채워 전체 체크로 통일). `updateInspectorPartAction`(파트 1개)을 `updateInspectorPartsAction`(파트 배열 일괄 upsert/delete)으로 교체. `components/ui/checkbox.tsx`에 `data-indeterminate` 스타일(주황) 추가(기존 사용처 영향 없음, 추가적 스타일). 실제 사업장 4곳 확인(DB 조회): 한국공항공사(파트 1개: 소방), 항국공항보안(1개: 보안, 사업장명 자체 오타 기존 유지), 상주업체(5개), 남부공항서비스(6개). `tsc --noEmit`·`next build --webpack` 통과.
- **2026-07-26** — **점검자 배정 화면: "사업장 전체 배정됨" 표시 + 사업장별 전환식 UI.** 조사 배경: 점검자 배정(`/assignments`)에서 파트 체크를 안 했는데 QR 점검이 되는 문제 제보 → 코드 감사 결과 **버그 아님**. `has_part_access`는 `user_parts`(특정 파트) 뿐 아니라 **`user_sites`(사업장 전체) 배정만으로도 그 사업장 모든 파트를 통과**시키는 설계(2026-07-25 관리파트 2단계)라, 사용자 관리에서 "담당 사업장 전체"로 배정된 점검자는 `/assignments`의 파트 체크와 무관하게 이미 전체 접근권을 가짐 — 그런데 화면은 이를 빈 체크박스로만 보여줘 혼동을 유발했음. **개선**: `InspectorPartAssignments`가 해당 파트 칸을 체크박스 대신 **"전체 배정됨"** 배지(초록, 툴팁으로 사용자 관리에서 파트 단위로 좁히는 방법 안내)로 표시하고 토글을 막음. `assignments/page.tsx`가 `user_sites`를 함께 조회해 `siteIdsByInspector` 전달. **신규 마이그레이션** `20260726120000_user_sites_admin_scoped_read.sql`: 일반 관리자는 기존에 다른 사용자의 `user_sites`를 못 읽어(정책이 본인 행 또는 시스템관리자로만 한정) 이 배지가 시스템관리자 눈에만 보였음 — `has_site_access(site_id)` 안의 점검자 대상 `user_sites`를 관리자도 읽을 수 있는 SELECT 정책 추가(**서울 운영 DB 적용 완료**). 추가로 **파트 수가 많으면 표가 지나치게 넓어지는 문제**를 점검현황과 동일한 **상단 "사업장 버튼" 전환식**으로 바꿔 해결(선택된 사업장의 파트만 열로 표시) — 이 전환식 UI는 바로 다음 항목(파트→사업장 단위 재설계)에서 다시 교체됨. `next build --webpack`·`tsc --noEmit` 통과.
- **2026-07-26** — **매뉴얼 PDF 배포본 + 인쇄 페이지 나눔 개선, 도움말 문구 정리.** `manual/매뉴얼.html`에 인쇄용 스타일(라이트 고정·A4·표지)과 **각 번호 섹션을 `.doc-sec`로 감싸 페이지 중간 잘림 방지**(안 들어가면 섹션 통째로 다음 장) 추가 → 헤드리스 Chrome `--print-to-pdf`로 `manual/소화기점검_매뉴얼.pdf`(16p, 한글 폰트 임베딩) 생성. HTML FAQ의 "아직 없는 기능" 섹션 삭제. 앱 도움말(`app/help/page.tsx`) 관리자용 "소화기 검색·수정·직접 점검" 카드에서 **직접 점검 항목 삭제**(제목 "소화기 검색·수정"). (PDF는 `매뉴얼.html`을 브라우저 Ctrl+P로도 재생성 가능.)
- **2026-07-26** — **서비스워커 업데이트 방식 개선 — 배포 후 "새 버전 있음 → 새로고침" 안내.** 배포해도 이미 열린 탭이 옛 SW/청크로 계속 돌아 화면이 안 바뀌던 문제 해결. `app/sw.ts`의 `skipWaiting: true→false`(새 SW를 대기 상태로 둠, `clientsClaim`은 유지). `next.config.ts`에 `register: false`(프레임워크 자동 등록/`reloadOnOnline` 끄고 직접 제어). `ServiceWorkerRegister.tsx` 재작성: 새 SW 설치 감지 시 **sonner 토스트로 "새로고침" 안내**, 사용자가 누르면 `SKIP_WAITING` 메시지 전송(serwist 코어가 받아 `skipWaiting()`) → `controllerchange`에서 **1회 리로드**(전체 리로드라 Next.js 라우터 캐시·SW 캐시 함께 갱신). **강제 리로드는 안 함**(현장 점검 입력 중 유실 방지) — 안내형. 첫 설치 시 clientsClaim의 controllerchange로는 리로드 안 하도록 `userTriggeredUpdate` 플래그로 게이트, `visibilitychange` 시 `registration.update()`로 새 배포 조기 감지. `next build --webpack` 통과, `public/sw.js`는 gitignore(빌드 재생성).
- **2026-07-26** — **앱 내 도움말(`/help`) 최신 기능 반영 갱신(코드).** `manual/` 문서만 고치고 앱 도움말 페이지는 옛 내용 그대로여서 함께 갱신. 점검자용: 점검 항목 **5개**(기타사항 정상)·"비고"→**이상(불량) 내용**·**배정 파트만 점검 가능** 안내·이상→관리자 조치 후 완료 집계. 관리자용: 메뉴에 **점검자 배정** 추가·**관리파트**(관리번호 앞자리·코드 변경 시 QR 재출력) 설명·소화기 등록에 파트 선택·관리번호 표기 `기관-`→`파트-`·점검현황 **4탭 + 이상사항 조치 워크플로우**·**점검자 배정** 카드·문제해결에 "점검자 권한 없음→파트 배정" 추가. `app/help/page.tsx`만 수정(`tsc --noEmit` 통과).
- **2026-07-26** — **사용자 매뉴얼(`manual/`) 최신 기능 반영 갱신.** 2026-07-19 작성 이후 추가된 기능들을 점검자·관리자 매뉴얼에 반영: **관리파트**(사업장/건물 관리의 관리파트 CRUD·소화기 등록 시 파트 선택·관리번호 앞자리·코드 변경 시 QR 재출력 주의), **점검현황 4탭**(미점검/조치필요/조치완료/점검완료)과 **이상사항 조치 워크플로우**([조치]→조치내용 입력→조치완료), **점검자 배정**(`/assignments`, 관리자→점검자 파트별 점검권한 매트릭스) 메뉴, 점검 체크항목 **5개**(기타사항 정상 추가), 사용자 관리의 **사업장 전체/특정 파트** 배정. 버전 1.0→1.0.4, 작성일 2026-07-26으로 통일, 표지의 대상 기관/회사명 표기 제거(일반화). FAQ에 "점검자 스캔 권한 없음→파트 배정 요청" 항목, `테스트체크리스트.md`에 관리파트·5체크항목·4탭 조치 워크플로우·점검자 배정·사업장전체/파트 배정 검증 항목 추가, `images/스크린샷목록.md`에 신규 캡처(관리파트추가·조치처리·점검자배정) 반영. 추가로 **`manual/매뉴얼.html`**(설치·점검자·관리자·FAQ 4탭 전환형 단일 페이지, 라이트/다크 테마·모바일 지원, 상태 배지·주의/팁 콜아웃) 신규 작성 후 README 문서 목록에 등록. 코드 변경 아님(문서).
- **2026-07-25** — **관리파트(management_parts) 도입 — 관리번호 prefix·권한을 사업장에서 분리(2단계).** 한 사업장에서 소화기를 관리하는 조직이 여러 개(무안=공사/소방, 상주=기상/AQ/생명푸드/프리존/코드, 남부공항서비스=기계/전기/통신 예정)로 늘 수 있게, 관리번호 앞자리를 사업장(`org_code`)이 아닌 **사업장 하위 "관리파트"의 `code`**로 옮김. 건물/층은 파트 공용, **파트가 다르면 소화기 번호는 1부터 독립 채번**(스코프=층+파트/건물+파트). **1단계**(`20260725090000`): `management_parts` 테이블, `extinguishers.part_id`(등록 폼에서 선택, 비우면 트리거가 사업장 기본 파트로 채움), 트리거 재작성(파트 코드·채번), 파트 코드 변경 캐스케이드, 뷰에 `part_id/part_code/part_name`, 사업장 상세에 관리파트 CRUD(`PartFormDialog`), 사업장 폼에서 관리기관 코드 제거(`sites.org_code` nullable). **기존 소화기 479개는 각 사업장 org_code(공사/상주)를 기본 파트로 전환 → 관리번호(부착 QR) 불변.** **2단계**(`20260725100000`): `user_parts`(특정 파트 배정) + `has_part_access`/`fn_extinguisher_part_id`, `has_site_access`에 파트 배정 포함. 소화기/점검/사진/이력/조치 RLS를 **파트 스코프**로 교체(파트 배정 없으면 user_sites로 귀결돼 하위호환). 시스템관리자 권한 배정(`UserSitesDialog`)에 **사업장 전체/특정 파트** 선택, 관리자→점검자 **파트별 점검권한 부여** 페이지 `/assignments`(`updateInspectorPartAction`, RLS로 관리자 경계·대상=점검자 강제). **서울 운영 DB 적용 완료.** 두 마이그레이션 모두 구버전 코드와 호환(트리거 기본 파트 채움 + `select("*")` 여분 컬럼 무시).
- **2026-07-23** — **점검 체크항목에 "기타사항 정상"(etc_ok) 추가(5번째).** 압력/봉인/외관/설치로 분류되지 않는 그 외 이상을 표시할 곳이 없어 추가. 체크 해제 시 이상(불량) 내용에 상세 기입 → 불량항목에 "기타 불량"으로 표기(대장·조치필요/완료 목록 공용). `inspections.etc_ok`(not null default true) + `fn_submit_inspection`(오프라인 큐 대비 `coalesce(...,true)`) + 뷰 `last_etc_ok` 노출(마이그레이션 `20260723100000`, 서울 운영 DB 적용 완료). `computeOverallResult` 5개 항목으로 확장, 오프라인 Outbox(`OutboxInspection`)·양쪽 점검 화면(`InspectionChecklist`·`AdminInspectDialog`)에 반영. 기존 점검은 기타사항 정상으로 간주.
- **2026-07-23** — **점검현황에 "조치완료" 탭 추가(이번달 조치 내역 확인).** 조치필요 소화기를 조치완료하면 이제 별도 **조치완료** 탭에서 불량항목·불량내용·**조치내용**·조치일을 확인할 수 있음(읽기 전용, `ResolvedActionList`). 점검완료 탭은 **정상 점검완료만**(`isNormalDone`)으로 분리 → 탭이 `미점검/조치필요/조치완료/점검완료` 4개. **매달 1일 초기화는 자동** — 목록을 `inspected_this_month`(최근 점검이 이번달)로 gate하므로, 새 달에 점검이 시작되면 지난달 조치는 자연히 빠지고 그달 조치만 표시(DB 기록은 감사용으로 보존). `lib/utils/inspection.ts`에 `isActionResolved`/`isNormalDone` 추가. (점검률 집계 `isMonthDone`=정상+조치완료는 유지.)
- **2026-07-23** — **이상사항 조치(조치필요→조치완료) 워크플로우 + 대장 불량내용/조치내용 분리.** ① 대장 Excel에서 비고(memo)가 "조치내용"으로 나가 혼동되던 것을 바로잡음 — 비고=**불량내용**으로 정착하고, 대장에 `불량항목`·`불량내용`(비고)·`조치내용`(별도)을 분리, `이번달점검(O/X)`을 `이번달상태(미점검/조치필요/완료)`로 변경. ② 이상으로 기록된 소화기는 **점검현황·대시보드에 "조치필요"** 로 분류되고, 관리자가 **조치내용을 입력하고 "조치완료"** 를 눌러야 이번달 **점검완료**로 집계(점검률·대시보드 완료 카운트 반영). 조치필요는 미완료로 취급 → `미점검/조치필요/점검완료` 3분류. 점검 기록은 append-only 유지, 조치는 별도 `inspection_actions` 테이블에 append(관리자 전용 RLS, 담당 사업장 범위 한정). 신규: 마이그레이션 `20260723090000_inspection_actions.sql`(테이블 + 뷰/`fn_dashboard_summary`/`fn_inspection_rate` 갱신), `app/actions/inspectionActions.ts`(`resolveInspectionAction`), `lib/utils/inspection.ts`(불량항목/완료판정 공용), `components/admin/ResolveActionDialog.tsx`·`ActionRequiredList.tsx`. 점검 입력의 "비고" 라벨을 "이상(불량) 내용"으로 명확화. **서울 운영 DB(`zbdvuxzoahusdrpniuwz`) 적용 완료.** (작업 중 CLAUDE.md의 옛 뭄바이 ref가 낡아 있던 것을 서울 DB로 정정.)
- **2026-07-21** — **앱 아이콘·파비콘을 소화기 그림으로 교체.** 기존 임시 빨간 원 대신 소화기 일러스트(빨간 본체·검정 손잡이·호스·노즐)를 적용. `public/icons/icon-192.png`·`icon-512.png`(흰 배경, 여백 14%), `icon-maskable-512.png`(런처가 원형으로 잘라내므로 **안전영역 62%**로 축소 배치), `app/favicon.ico`(투명 배경, **16/32/48/64/128/256px 6종** — 브라우저가 만드는 바탕화면 바로가기는 파비콘을 확대해 쓰므로 큰 사이즈 필요. Next.js는 ICO **첫 엔트리**로 `sizes`를 정하고 너비 바이트 `0`을 256으로 해석하므로 256px를 맨 앞에 배치 → `sizes="256x256"`). 원본 PNG의 배경은 테두리에서 플러드필로 제거해 소화기만 추출(안쪽 흰 라벨은 보존). **iOS 대응**: 사파리는 "홈 화면에 추가" 시 `apple-touch-icon`을 우선 사용하는데 링크가 없어 스크린샷/흐린 파비콘이 잡힐 수 있었음 → `app/apple-icon.png`(180×180, **불투명 흰 배경** — iOS는 투명도 미지원, 자체 라운드 마스크 적용) 추가해 Next.js가 링크를 자동 생성하도록 함. 부수: 바탕화면 바로가기용 `extinguisher.ico`(16~256px 6종)를 `%LOCALAPPDATA%\shg-inspector\`에 생성하고 `.url` 바로가기에 연결(로컬 작업, 저장소 무관).
- **2026-07-20** — **점검자 QR 스캐너 아이폰 속도·거리 대폭 개선(ZXing-C++ WASM 디코더 주입).** 아이폰 사파리는 네이티브 `BarcodeDetector`가 없어 html5-qrcode가 느린 순수 JS 디코더(zxing)로 폴백 → 인식 느리고 원거리/작은 QR 취약. 라이브러리 소스 분석 결과 **해상도를 올려도 거리 개선 안 됨**(디코딩 캔버스가 화면 표시 크기로 다운스케일되어 상쇄). 해결: **`barcode-detector`(ZXing-C++ WASM) 폴리필을 `window.BarcodeDetector`로 주입** → html5-qrcode가 이 고속 디코더 사용(iOS도 안드로이드급). WASM은 `public/zxing_reader.wasm`으로 **앱에 포함(CDN 미의존)**, `setZXingModuleOverrides.locateFile`로 로컬 경로 지정. **안전장치**: 마운트 시 빈 캔버스로 워밍업 detect를 돌려 **WASM이 실제 로드된 경우에만 폴리필 설치** — 실패(오프라인/로드오류) 시 조용히 기존 JS 디코더로 폴백해 스캐너가 깨지지 않음(싱글턴 1회 로드). 부수: qrbox 0.7→0.8, 스캐너 뷰 `max-w-sm`→`max-w-md`로 확대(디코딩 픽셀↑). `components/inspector/QRScanner.tsx`, 의존성 `barcode-detector` 추가.
- **2026-07-20** — **점검자 QR 스캐너 인식률·속도 개선(안드로이드/아이폰 공통).** ① 카메라 제약에 **연속 자동초점(`focusMode: continuous`, top-level + `advanced`)**을 요청해 가까이 붙였을 때 초점이 흐려지는 문제 완화. ② **스캔 박스(qrbox)를 고정 250×250 → 뷰파인더의 70% 비례 크기**로 확대해 조금 떨어진 거리에서도 QR이 박스 안에 들어오게 함(멀면 인식 안 되던 문제). ③ **`experimentalFeatures.useBarCodeDetectorIfSupported`**로 네이티브 BarcodeDetector(안드로이드 크롬 등) 사용 + **`formatsToSupport`를 QR로 제한**해 디코딩 속도 향상, `fps` 10→15. ④ **iOS 대응**: 아이폰 사파리는 BarcodeDetector 미지원으로 JS 디코더(zxing) 폴백 시 고해상도일수록 느려지므로, **네이티브 감지 지원 여부로 해상도 분기**(지원=1920, 미지원(iOS 등)=1280). `components/inspector/QRScanner.tsx`.
- **2026-07-19** — **도움말 역할별 분기 + 로그인 화면에서 제거 + 점검자 헤더 정렬 정리.** ① 로그인 화면의 도움말 링크 제거(버전 표기는 유지), 미들웨어 `PUBLIC_PATHS`에서 `/help` 제거(로그인 필요). ② `/help`를 서버 컴포넌트로 바꿔 **역할별 내용**을 보여줌 — 관리자는 관리 기능, 점검자는 현장 점검 방법만. 뒤로가기는 `BackButton`(신규, `router.back()`) 분리. ③ 점검자 헤더의 스캔·현황·도움말·계정·로그아웃을 **모두 아이콘 전용(size-9 정사각)으로 통일**해 "소화기 점검" 제목과 아이콘들이 어긋나던 것 정렬. `SignOutButton`에 `iconOnly` 프로프 추가(관리자/계정 화면은 기존 텍스트 버전 유지).
- **2026-07-19** — **QR 손상 시 관리번호 직접 입력 점검 기능 제거(되돌림).** 실제로 소화기 앞에 가지 않고도 관리번호만 입력해 점검할 수 있는 허점이 되어 삭제. `ManualCodeEntry` 컴포넌트 제거, `/scan`에서 제외, 도움말/매뉴얼(사용자·FAQ·테스트체크리스트·스크린샷목록)에서 관련 안내 삭제하고 "점검은 QR 스캔 필수, 라벨 손상 시 재발급"으로 대체. 점검은 다시 **QR 스캔(스캔 통행증)으로만** 가능. (라벨 재발급은 QR Code 관리에서.)
- **2026-07-19** — **앱 내 버전 표시 + 도움말 페이지 추가.** ① `lib/version.ts`의 `APP_VERSION`을 로그인 화면·관리자 사이드바 하단·도움말 페이지에 노출. ② 자체 완결형 도움말 페이지 `/help`(외부 링크 없음, 오프라인/CSP 안전) — 점검 순서·QR 손상 대처·오프라인·관리자 메뉴·자주 발생하는 오류·버전. 로그인 전에도 보도록 미들웨어 `PUBLIC_PATHS`에 `/help` 추가. 링크: 관리자 네비(`adminNav`에 도움말 항목)·점검자 헤더(물음표 아이콘)·로그인 화면. 매뉴얼에도 반영.
- **2026-07-19** — **QR 손상 시 관리번호 직접 입력 점검 추가.** 점검자 `/scan` 화면 카메라 아래 "QR이 손상됐나요? 관리번호 직접 입력" → 관리번호 입력 후 "점검 시작"이 **스캔과 동일하게** 동작(입력값을 스캔 페이지 `handleScan`에 그대로 넘겨 `setScanPass` 발급 + `/inspect/{code}` 이동). 신규 `components/inspector/ManualCodeEntry.tsx`. 라벨의 관리번호는 소화기 앞에서 읽어야 하므로 현장 확인 전제는 유지. 매뉴얼(사용자매뉴얼·FAQ·테스트체크리스트·스크린샷목록)에도 반영.
- **2026-07-19** — **사용자 매뉴얼 문서 추가(`manual/`).** 설치가이드/사용자매뉴얼(점검자)/관리자매뉴얼/FAQ/테스트체크리스트 + `images/스크린샷목록.md`(넣을 스크린샷 파일명 목록)·`README.md`. 실제 메뉴명·버튼·화면 흐름을 소스에서 확인해 작성(존재하지 않는 기능은 배제, 비밀번호찾기·화면내 백업/복원 등 미구현은 명시). 초보자용 서술·주의/팁 박스·스크린샷 삽입 위치 표기. 코드 변경 아님(문서).
- **2026-07-19** — **소화기 관리 검색에 위치(한글) 추가.** 관리번호·제조번호에 더해 **위치 문자열(`formatShortLocation`: 건물명/층/설치위치, 차량은 번호판/차종/부서)**도 부분 매칭. 목록에 이미 쓰던 함수를 검색 필터에 재사용(추가 조회 없음). placeholder를 "관리번호·제조번호·위치 검색"으로. `ExtinguisherListClient`.
- **2026-07-19** — **통계 "이번달 점검자별 실적"의 이번달 경계 UTC 버그 수정.** `startOfMonth`를 서버(UTC) `new Date()`로 잡아 KST 1일 00:00~09:00 점검이 이번달 실적/이상비율에서 누락되던 문제. `toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"})`로 KST 연·월을 구해 `{YYYY-MM}-01T00:00:00+09:00`의 UTC ISO를 하한으로 사용. (점검 초기화 기준인 `v_extinguisher_overview.inspected_this_month`·`fn_dashboard_summary`·`fn_inspection_rate`는 이미 `at time zone 'Asia/Seoul'` 기반이라 매월 1일 KST 초기화 정상 — 이 통계 카드만 JS 계산이라 어긋나 있었음.)
- **2026-07-19** — **소화기 제조일 입력을 연·월(YYYY-MM)만 받도록 변경 + 해당 월 1일로 저장.** 명판에 제조년월까지만(예: 2026.12) 찍혀 있어 일(day) 입력을 없앰. 신규 `MonthInput` 컴포넌트(월 선택기, `202612`→`2026-12` 자동 포맷), Zod `manufacture_date` 정규식 `^\d{4}-\d{2}$`로 변경, 폼 제출 시 `-01`을 붙여 **매월 1일 기준**으로 DB 저장(교체예정일 계산도 이 기준). 수정 화면은 기존 날짜의 앞 7자리(연·월)만 노출. `ExtinguisherForm`·`extinguisher.schema.ts`. (`DateInput`은 다른 곳에서 계속 사용, 보존.)
- **2026-07-19** — **건물/층 관리에서 구역(zone) 추가 UI 제거.** 구역을 실제로 쓰지 않으므로 `FloorList`의 층별 "구역 추가" 버튼과 구역 표시 목록(`ZoneFormDialog`)을 제거, 상위 `sites/[siteId]` 페이지의 zones 조회·`zonesByFloor` prop도 정리. **zones 테이블/데이터·`ZoneFormDialog` 컴포넌트 파일은 보존**(기존 데이터 유지, 현재 미사용).
- **2026-07-19** — **통계 "구역별 이번달 점검률" → "건물별"로 수정(버그).** 소화기 등록에서 구역(zone) 입력을 제거해 대부분 소화기의 `zone_id`가 비어 있는데, 통계 페이지만 `fn_inspection_rate`를 `group_by:"zone"`으로 호출해 **이름 없는 한 덩어리(group_name=null)로 뭉쳐 빈 막대처럼 표시**되던 문제. 대시보드·점검현황과 동일하게 `group_by:"building"`으로 바꾸고, 이름 있는 건물만 가나다순 정렬. `app/(admin)/stats/page.tsx`.
- **2026-07-19** — **소화기 완전 삭제(폐기·철수) 기능 추가.** 소화기 상세 페이지 헤더에 **삭제 버튼**(`DeleteExtinguisherButton`) → 확인 다이얼로그에서 **관리번호를 정확히 입력해야** 활성화(되돌릴 수 없는 작업 안전장치). 서버 액션 `deleteExtinguisherAction`(`app/actions/extinguisherActions.ts`): **소화기 행 삭제는 RLS 사용자 클라이언트**로 수행해 담당 사업장 밖 소화기는 못 지우게 하고, 점검기록·`inspection_photos`는 FK cascade로 함께 삭제, **cascade 대상이 아닌 Storage 실제 사진 파일은 삭제 전 경로를 확보해 admin 클라이언트로 별도 정리**. 점검 이력 있는 소화기는 다이얼로그에서 "점검 이력·사진도 영구 삭제" 경고. (사용자 선택: 소프트삭제 아닌 항상 완전 삭제.)
- **2026-07-19** — **소화기 관리 제조번호 표시를 종류 컬럼 아래로 이동.** 종류 컬럼 헤더를 "종류/제조번호"로, 관리번호 아래에 있던 제조번호를 종류(용량) 아래에 작게 표시.
- **2026-07-19** — **소화기 관리 검색에 제조번호(serial_no) 추가.** 검색어가 관리번호뿐 아니라 **제조번호에도 매칭**되도록 `ExtinguisherListClient` 필터 확장(placeholder도 "관리번호·제조번호 검색"). 검색 결과에서 확인되게 목록 관리번호 아래에 **제조번호를 작게 표시**. `v_extinguisher_list` 뷰에 이미 `serial_no`가 노출돼 있어 마이그레이션 없이 클라이언트만 수정.
- **2026-07-19** — **점검현황 전체를 사업장 선택으로 구동 + 탭을 이번달 미점검/점검완료로 변경.** 사업장 토글이 점검률뿐 아니라 **미점검/점검완료 목록·관리대장 다운로드까지 모두 그 사업장으로 한정**(기존엔 목록이 전체 사업장 소화기를 보여줌). 탭에서 **"오늘 미점검" 제거**, **이번달 미점검 / 점검완료(이번달 점검됨)** 2탭으로 변경. `InspectionStatusClient`로 통합(사업장 state가 rate/목록/다운로드 공유), 기존 `InspectionRateBySite` 삭제. `UninspectedList`에 `emptyMessage` prop 추가(점검완료 탭 빈 메시지용).
- **2026-07-19** — **점검자 사진 UI에 카메라 버튼 추가.** 기존 브라우저 기본 `<input type=file>`(문구만 있어 뭘 눌러야 할지 불명확)을 숨기고(`sr-only`), 카메라 아이콘 + "사진 촬영/사진 추가 촬영" 버튼으로 촬영을 열도록 변경(`fileInputRef.click()`). `InspectionChecklist.tsx`.
- **2026-07-19** — **관리대장 다운로드를 사업장 토글과 연동.** 점검현황 상단의 사업장별 다운로드 버튼 묶음(`LedgerDownloadButtons`)을 제거하고, 건물별 점검률의 **사업장 선택 토글**(`InspectionRateBySite`) 옆에 **선택된 사업장 대장 다운로드 버튼 1개**를 둠 → 무안 선택 시 무안 대장, 상주 선택 시 상주 대장만 받아짐. `LedgerDownloadButton`을 단일 사업장(`site` prop)용으로 변경.
- **2026-07-19** — **관리대장 표지 보유현황을 2단 헤더(종류→용량)로 변경.** 기존 대장처럼 상위행에 소화기 종류(용량 컬럼들 위로 가로 병합), 하위행에 용량을 배치. 종류+용량을 한 칸에 합쳐 쓰던 방식(`분말 3.3kg`) 폐기 → 종류 아래 용량 세분(`분말 | 2.5kg·3.3kg·4.5kg`). 데이터 행은 헤더 2행(7·8행) 다음(9행)부터. `typeGroups`로 종류별 컬럼 범위 계산.
- **2026-07-19** — **관리대장 최근점검일 KST 보정(버그 수정).** 라우트가 `last_inspected_at`(timestamptz, UTC ISO)를 `.slice(0,10)`로 잘라 써서 KST 00:00~09:00 점검이 **하루 이르게(예: 07-19→07-18)** 표시되던 문제 수정 → `kstDate()`(`toLocaleDateString("en-CA",{timeZone:"Asia/Seoul"})`)로 변환. 테스트 점검 삽입으로 발견.
- **2026-07-19** — **관리대장: 표지 보유현황을 종류+용량별로 세분 + 점검 이상내용 컬럼 추가.** ① 표지 보유현황 열을 종류만이 아닌 **종류·용량 조합**(예: `분말 3.3kg`, `CO2 4.6kg`)으로 세분(무안 15조합/상주 4조합). ② 점검대장에 **불량항목**·**조치내용** 2개 컬럼 추가 — 최근 점검의 **불량 항목**(압력/봉인/외관/설치 불량)과 **비고(memo, 교체 등 조치 내용)**를 각각 표시(`defectItems()`/`actionNote()`). 이를 위해 `v_extinguisher_overview`에 `last_inspection_memo`·`last_pressure_ok`·`last_seal_ok`·`last_appearance_ok`·`last_installation_ok` 노출(마이그레이션 `20260719090000`, 서울 DB 적용 완료). `Combo` 타입/`inspectionNote()` 추가.
- **2026-07-19** — **관리대장 Excel을 사업장별 개별 파일로 분리 + 표지 동·층별 보유현황.** 점검현황 상단에 **사업장별 다운로드 버튼**(`LedgerDownloadButtons`, 사업장마다 1개) → `GET /api/ledger/download?site=<siteId>`가 그 사업장만 담은 파일 생성(파일명 `소화기관리대장_{사업장}_{날짜}.xlsx`). 표지 보유현황표를 **동·층별 종류/수량 교차표**로 개편(건물 세로 병합, 층별 행, 종류별 총계 + 총계 행; 차량은 층 "차량"). 점검대장 시트 **위치 컬럼 폭 40→58**(위치 전체 표시), 위치 셀 좌측 정렬. `buildCoverSheet`/`buildLedgerSheet` 분리.
- **2026-07-18** — **소화기 관리대장 Excel(.xlsx) 다운로드 추가.** 점검현황 페이지 상단 "관리대장 다운로드" 버튼 → `GET /api/ledger/download`(관리자 전용, RLS로 담당 사업장만 포함). 소화기 1대당 1행, `v_extinguisher_overview` 기반에 관리번호·위치·종류·용량·제조일·제조번호·내용연수·교체예정일·내용연수상태·**최근점검일·점검결과·점검자·이번달점검(O/X)**을 담음. 관리번호 자연정렬(`sortByAssetCode`), 최근 점검자 이름은 `profiles`에서 매핑. `exceljs` 의존성 추가(헤더 고정행·테두리 스타일). 신규: `app/api/ledger/download/route.ts`, `components/admin/LedgerDownloadButton.tsx`.
- **2026-07-18** — **대시보드 건물별 점검률을 건물명 가나다순 정렬.** `fn_inspection_rate`는 `group by`만 하고 정렬을 안 줘서 순서가 불규칙했음 → 대시보드 페이지에서 `group_name`(건물명) 기준 `localeCompare(...,"ko")`로 정렬해 `InspectionRateChart`에 전달. (점검현황은 건물번호 순, 대시보드는 가나다순.)
- **2026-07-18** — **점검현황 건물별 점검률을 사업장별 버튼 + 건물번호 순 정렬로 변경.** 상단 사업장 버튼으로 전환, 건물번호 오름차순 정렬. `fn_inspection_rate`는 site_id/building_no를 안 줘서, 페이지가 `v_extinguisher_overview`를 한 번만 불러와 미점검 목록 + 건물별 점검률을 클라이언트에서 집계(`InspectionRateBySite`). (기존 3쿼리 → 1쿼리.)
- **2026-07-18** — **공사 건물번호 재구성 + 소화기 번호 재부여**(데이터, 점검 이력 0건이라 rebuild). 여객터미널을 **1=여객터미널(일반)/2=여객터미널(격리)**로 분리(격리는 원본 "격리대합실" 주석으로 판별, 지하·옥상·차량은 일반), 나머지 건물 **+1**(관리동3…화물청사13), **사고현장은 15 유지**. 각 건물·층별 소화기 번호를 **1부터 재부여**. **주기장 소화전은 `공사-1-1-11·12·13`(괄호 없는 정수, CO2 4.6kg 3본)** 로 정상화(이전 괄호/임시번호 방식 폐기), 뒤 번호 +2 밀림. 최종 번호는 사용자가 대장 순서 확정 후 재요청 예정. (임시 Node 스크립트 수행, 재배포 불필요.)
- **2026-07-18** — **라벨 레이아웃 정리 + 화면 미리보기 추가.** 배치를 **세로 중앙 정렬**(QR 위 → 관리번호 굵게 → 위치 작게 최대 2줄, 모두 가운데)로 하고 여백/글자크기·QR 크기를 라벨 규격에 비례하게 계산(세로로 안 잘리게). 공용 `LabelCard`(미리보기·인쇄 공용, mm 비율 렌더) 신설 → QR Code 관리(선택 첫 항목)·소화기 상세 QR/라벨에서 **실제 라벨 배치를 화면에서 바로 확인** 가능(인쇄 전 조정). `PrintLabelSheet`는 `LabelCard` + 페이지 분할만 담당.
- **2026-07-18** — **소화기 상세 QR/라벨 화면도 라벨 크기 조절식으로 통일.** 기존 고정 220px QR + (프린터 없어 항상 비활성이던) Zebra 버튼을 제거하고, QR Code 관리와 동일한 크기 옵션 + 라벨 규격 인쇄로 교체. 크기 옵션 UI를 공용 컴포넌트 `LabelSizeControls`(+ `DEFAULT_LABEL_SIZE`)로 추출해 일괄/단일 화면이 동일 동작. `lib/qr/zebraPrint.ts`·`labelTemplate.ts`는 실제 Zebra 프린터 확보 후 ZPL 직접 전송용으로 보존(현재 미사용).
- **2026-07-18** — **라벨 인쇄: 크기 조절 + 한 장씩 정확 출력.** QR Code 관리에서 라벨 크기(프리셋 50×30/40×30/60×40/30×20 mm + 직접 지정)와 위치 표시 여부를 고르고, 선택 QR을 라벨 규격대로 **한 장에 하나씩** 인쇄. `components/admin/PrintLabelSheet.tsx` 신설(`@page { size }` + `break-after: page`, 화면 숨김/인쇄시 표시, `#pl-sheet`). 기존 `QrLabelCard.tsx`(A4 격자용) 제거. Zebra 등 라벨프린터는 Windows 드라이버/AirPrint 인쇄로 동작, 모바일 현장 출력은 OS 인쇄(안드로이드 Bluetooth·Mopria / iOS AirPrint)로 커버. (Zebra ZPL 직접 전송·Web Bluetooth는 실제 프린터 확보 후 별도 검토.)
- **2026-07-18** — 사이드바에서 **QR Code 관리를 통계 아래로 이동**.
- **2026-07-18** — **수량 현황을 사업장별 버튼 전환식으로 변경.** 상단에 사업장 버튼(무안국제공항/상주업체 등)을 두고 누르면 해당 사업장의 요약카드·건물×종류 교차표만 표시. 클라이언트 컴포넌트 `InventoryClient` 신설(전체 로드 후 즉시 전환), 건물 라벨에서 사업장명 생략(이미 버튼으로 선택). 기본 선택은 이름순 첫 사업장.
- **2026-07-18** — **성능: 목록/QR/수량 페이지 경량 뷰(`v_extinguisher_list`) 도입.** `v_extinguisher_overview`는 소화기마다 오늘/이번달 점검 여부를 EXISTS 서브쿼리로 계산(수백 행이면 비용 큼)하는데, 소화기관리·QR Code 관리·수량현황은 그 값을 안 쓴다. 두 서브쿼리를 뺀 경량 뷰로 교체(최근 점검일 lateral은 유지)해 479행 조회를 가볍게 함. 마이그레이션 `20260718090000`, 도메인 타입 `ExtinguisherListItem`, `AdminInspectDialog` 프로프를 `Pick<...,"id"|"asset_code">`로 축소. 점검현황/점검자 현황 등 점검 상태가 필요한 페이지는 기존 뷰 유지. (Vercel 함수 리전을 서울로 옮긴 뒤 남은 첫 로딩 부담을 추가로 줄임.)
- **2026-07-18** — **성능: 앱 재실행 흰 화면(콜드 스타트) 단축.** 재실행 시 `/scan` 복원 → 점검자 레이아웃 → `/dashboard` 리다이렉트 → 관리자 레이아웃으로 이어지며 **레이아웃마다 `getUser()`(인증서버 왕복)**가 쌓여 흰 화면이 길었음. 루트(`app/page.tsx`)·관리자/점검자 레이아웃의 인증 확인을 **`getUser()`→`getSession()`(쿠키 로컬)**으로 변경(미들웨어 세션 검증 + RLS로 데이터 보호 → 보안 동일, 왕복만 제거). 루트 로딩 폴백(`app/loading.tsx`) 추가. (관리자는 가드로 더 이상 `/scan`에 머물지 않으므로 이후 재실행은 관리 화면을 바로 복원.)
- **2026-07-18** — **버그: 관리자가 점검자 화면에 갇히는 문제 수정.** 점검자 레이아웃(`app/(inspector)/layout.tsx`)이 로그인만 확인하고 역할은 안 봐서, 관리자가 PWA 화면 복원/루트 프로필 조회 순간 실패 등으로 `/scan`에 들어오면 관리 화면으로 갈 링크가 없어 갇혔음(재로그인해야 탈출). 이제 레이아웃에서 **관리자면 `/dashboard`로 서버 리다이렉트**(`isAdminRole`) → 관리자는 점검자 화면에 머무를 수 없음. (Serwist 내비게이션은 NetworkFirst라 온라인 재실행 시 리다이렉트 동작.)
- **2026-07-18** — **QR Code 관리 페이지 신설**(`/labels`, 사이드바 "QR Code 관리"). 소화기를 검색·필터(사업장/상태/관리번호)하고 **다중 선택 → 한 번에 인쇄**(`window.print()`, 인쇄 CSS로 `#print-area`의 라벨 그리드만 출력, `.qr-label { break-inside: avoid }`). QR은 관리번호로 실시간 생성(`QrLabelCard`, qrcode `toDataURL`)이라 **등록/관리번호 변경이 바로 반영**되도록 페이지를 `force-dynamic` + **새로고침 버튼**(router.refresh) 제공. 신규: `components/admin/QrBulkPrint.tsx`·`QrLabelCard.tsx`. 개별 라벨 출력(소화기 상세→QR/라벨)은 그대로 유지.
- **2026-07-18** — **목록 성능: 클라이언트 필터 + 페이지네이션(50개/페이지).** 소화기 관리는 전체를 한 번만 불러와 사업장/상태/검색을 **클라이언트에서 즉시 필터**(기존엔 필터·검색 한 글자마다 수백 행 서버 재조회 → 버벅임·무반응). 점검현황 미점검·내용연수 관리·사진 관리도 페이지네이션 적용(사진은 관리번호 그룹 단위). 공용 `components/ui/pagination.tsx`, 목록 컴포넌트 `ExtinguisherListClient`/`UninspectedList`/`LifecycleList` 신설, 서버 필터 방식 `ExtinguisherFilters` 제거. (필터가 URL에 안 담기는 대신 즉시 반응.)
- **2026-07-18** — **상주업체 소화기 17개 입력 + 사업장 재구성**(2단계). 처음엔 회사별 org(기상/AQ/식당/프리존/코드) 사업장 5개로 넣었다가, **사업장 1개 `상주업체`(org_code `상주`) + 회사별 건물**로 통합: 1동 기상대(6)·2동 AQ(2)·3동 생명푸드(6,층2 유지)·4동 프리존(1)·5동 코드주식회사(2). 관리번호 `상주-1-1-1`~`상주-5-1-2`. 종류: 분말 15·할론 1(기상 전산실)·K급 1(생명푸드 주방). **최종 사업장 2개**: `공사`(무안국제공항 462) + `상주`(상주업체 17) = 전체 **479개**. 임시 Node 스크립트 수행(사용 후 삭제), 데이터라 재배포 불필요(운영 DB 즉시 반영).
- **2026-07-18** — **관리번호/건물 목록 자연 정렬** 통일. 문자열 정렬로 `공사-15`가 `공사-2`보다 앞, `...-1-1-10`이 `...-1-1-2`보다 앞, `10동`이 `2동`보다 앞으로 오던 문제 수정. `lib/utils/sort.ts`(`compareAssetCode`/`sortByAssetCode`, `localeCompare(..,{numeric:true})`) 추가 후 점검현황·소화기관리·점검자 건물상세에 `sortByAssetCode` 적용, 점검자 건물요약·수량현황(inventory) 건물 정렬에 `{numeric:true}` 적용. (lifecycle=교체예정일순, photos=최신순은 의도된 정렬이라 유지.)
- **2026-07-18** — 점검현황에서 **층별 이번달 점검률 카드 제거**(건물별만 유지, 전체 폭). `fn_inspection_rate` floor 조회도 제거.
- **2026-07-18** — **실제 관리대장(무안공항) 데이터 일괄 입력.** `2026 소화기 관리대장.xlsx`에서 본청(org_code `공사`) **462개** 소화기를 서울 DB에 입력(건물 13·층 35·차량 10, 신규 종류 4종 `간이소화기/청정소화기/N2소화기/K급소화기` 추가). 관리번호는 트리거로 레거시 코드 그대로 재생성(부착 QR과 일치). **교정한 오타**: 청청→청정, 하론→할론, `축압식3.3kg` 공백, 제조년월 `22.4`→`22.04`, 관리번호 앞 공백. **충돌 해소**: `공사-1-1-80` 중복 → 입국심사장 상주통로를 `공사-1-1-82`로; 복사중복 2행 삭제. **주기장 소화전 3본**은 트리거가 못 만드는 `공사-1-1-11(1/2/3)` 형식이라 임시번호로 넣고 `asset_code`만 직접 지정(→ 그 소화기의 층/위치를 UI에서 바꾸면 번호 재생성되니 주의). 내용연수는 분말만 10년, 나머지 없음. **미완**: 상주업체 17개(기상/AQ/식당/프리존/코드) 2단계 예정, 제조번호 중복 4건(147306·12580·13923·57010/57047) 실물 확인 필요. 입력은 임시 Node 스크립트로 수행(사용 후 삭제), 마이그레이션 아님.
- **2026-07-17** — 소화기 **제조번호(serial_no)** 추가. 등록/수정 폼에서 거의 안 쓰는 **구역(zone) 입력을 제거하고 제조번호 입력으로 대체**(제조일 아래). QR 스캔 점검 화면에 종류·용량·제조일·**제조번호** 표시. `extinguishers.serial_no` 컬럼 + `v_extinguisher_overview`에 노출(마이그레이션 `20260717090010`). zone 테이블/컬럼은 유지(기존 데이터 보존), 폼에서만 미노출.
- **2026-07-17** — **성능: 관리자 섹션 이동 속도.** 사이드바/모바일 네비 링크에 `prefetch`(전체 프리페치)로 도착 섹션 데이터까지 미리 로드 → 첫 전환 즉시화. `next.config.ts`에 `experimental.staleTimes`(dynamic 30s/static 180s) 추가로 재방문 시 클라이언트 캐시에서 즉시 표시.
- **2026-07-17** — **성능: 미들웨어 인증 검증을 `getUser()`→`getSession()`으로 변경.** 화면 이동(프리페치 포함)마다 뭄바이 인증 서버로 네트워크 왕복하던 것을 제거(쿠키 로컬 읽기, 만료 시에만 갱신) → 로그인 후 이동 버벅임 대폭 완화. 최종 인증·권한 검증은 각 레이아웃 `getUser()` + RLS가 유지하므로 보안 동일. (근본적 지연 해소는 리전 이전 TODO 참고.)
- **2026-07-17** — 점검현황(미점검 목록) 위치 표기에 **소화기 설치위치(install_note)까지** 포함(`formatLocationPath`에 `withInstallNote` 옵션 추가, 점검현황에서만 사용 — 내용연수/LocationPath는 기존 유지).
- **2026-07-17** — 미들웨어(`lib/supabase/middleware.ts`) 방어 강화: `NEXT_PUBLIC_*` 환경변수 누락이나 Supabase 세션 조회 예외 시 사이트 전체가 500(`MIDDLEWARE_INVOCATION_FAILED`)으로 죽지 않고, 공개 경로는 통과·보호 경로는 `/login`으로 안전 폴백. (env가 빌드에 안 박힌 배포에서 발생하던 장애 방지.)
- **2026-07-17** — 소화기 등록/수정 폼에 **관리번호 끝자리(extinguisher_no) 수동 지정** 옵션 추가(설치 위치 아래). 비우면 트리거가 자동 채번(기존 동작), 지정하면 그 번호로 등록. 중복 시 `extinguishers_asset_code_key` 유니크 위반 → "관리번호 끝자리를 비우면 자동 부여" 안내. Zod에 `extinguisher_no`(정수 1~9999, optional) 추가.
- **2026-07-17** — 소화기 등록 폼에서 용량(capacity)을 소화기 종류 바로 아래로 이동, 라벨 `소화기 용량`. 소화기 종류 표시에 용량 함께 노출(예: `분말 (3.3kg)`) — 소화기 관리 목록·점검 화면.
- **2026-07-17** — QR 라벨 위치 표기도 짧은 형식으로 통일(사업장명 생략).
- **2026-07-17** — 점검 화면(QR 스캔 후)·현황 목록의 위치 표기를 소화기 관리와 동일한 짧은 형식(`formatShortLocation`)으로 통일(사업장명 생략, 차량은 번호판(차종)>관리부서). 점검 사진을 **덮어쓰기 → 누적**으로 변경(전·후 최대 5장, 개별 ✕ 삭제·재촬영 가능). 관리자 점검 모달 사진도 동일.
- **2026-07-17** — 소화기 관리에서 차량 위치 표기를 `건물 > 차량번호판(차종) > 관리부서`로(뷰에 `vehicle_department` 노출).
- **2026-07-17** — 차량 등록에 **관리부서(department)** 필드 추가(소방/전기/통신 등). 차량명 라벨을 `차량명 (차종)`으로. 사업장 상세 차량 칩에 부서 표시.
- **2026-07-17** — 사업장 단위 권한 분리: 사업장 등록/수정/삭제는 시스템관리자 전용, 일반 관리자는 **배정된 담당 사업장**의 건물·소화기·점검만 관리(RLS `has_site_access`를 super_admin 기준으로 좁힘). 사용자 관리에서 관리자·점검자에게 담당 사업장 배정 UI(`UserSitesDialog`, `updateUserSitesAction`) 추가. 소화기 관리 위치 표기를 `건물명 > 층 > 설치위치`로(사업장명 생략), 등록 폼에서 `설치 위치`(install_note)를 층 뒤로 올리고 `구역`은 맨 아래 선택 항목으로 이동.
- **2026-07-17** — 관리자 직접 점검을 관리자 영역 안 모달로 제공(`AdminInspectDialog`) — 소화기 관리 목록·상세에서 QR 없이 점검 완료. 점검자 화면으로 넘어가지 않음. PWA `start_url`을 `/scan`→`/`로 변경해 관리자가 앱 실행 시 대시보드로 진입하도록 수정.
- **2026-07-17** — CLAUDE.md(본 문서) 추가.
- **2026-07-17** — Git 브랜치 전략 도입(`main`/`develop`/`feature/*`) + README 문서화(작업 흐름/자동 배포/롤백/규칙).
- **2026-07-17** — 로그인 후 항상 역할 홈으로 라우팅(옛 `?redirectTo=/scan`으로 관리자가 점검자 화면 가던 문제 수정) + 루트 왕복 제거로 로그인 속도 개선.
- **2026-07-17** — **시스템관리자(super_admin) 역할 도입**. 사용자 추가/역할 변경 독점, 삭제·강등·비활성 보호. RLS로 일반 관리자의 프로필 직접 수정 차단.
- **2026-07-17** — 관리자 레이아웃 반응형화(모바일 사이드바 → 햄버거 드로어, 본문 전체 폭).
- **2026-07-17** — 성능: 소화기 캐시 사전 적재(prewarm) + 캐시 우선 조회로 QR→점검 화면 즉시 전환, 라우트 로딩 스켈레톤.
- **2026-07-17** — Vercel 배포(프로덕션 `shg-inspector.vercel.app`), 환경 변수 설정, README에 실행/Supabase/배포/마이그레이션 문서화.
- **2026-07-17** — 관리자 사진 ZIP 다운로드(관리번호별 폴더) + 점검완료 화면을 페이지 이동 대신 인라인 전환(멈춤 현상 수정).
- **2026-07-17** — 점검자 현황: 건물별 요약→상세 드릴다운. 점검자는 QR 스캔으로만 점검(관리자는 목록에서 직접 점검 가능).
- **2026-07-17** — 사진: 관리번호 워터마크(중앙), 휴대폰 저장, 점검당 최대 5장, 소화기당 서버 최신 5장 유지, 관리자 사진 관리.
- **2026-07-17** — 월 1회 점검 기준 대시보드, 내용연수 없음(CO2/할론) 지원, 제조일 타이핑 입력, KST 날짜 보정.
- **2026-07-17** — 차량을 건물 소속으로 변경(관리번호 `공사-{건물}-차-{n}`, 번호판 등록, 건물 수량에 포함).
- **2026-07-16** — 관리번호(asset_code) 체계 전면 도입(자동 생성 트리거, 변경 이력, 레거시 코드 조회). 마스터데이터 수정/삭제, 수량 현황, 층 순서 변경 UI.
- **2026-07-16** — MVP 초기 구축: 인증, 사업장/건물/층/구역/차량, 소화기+QR, 점검자 오프라인 플로우, 관리자 대시보드, 내용연수, 검색/이력.

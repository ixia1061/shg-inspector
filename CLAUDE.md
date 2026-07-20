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
    sites/[siteId]/        사업장·건물·층·구역·차량 관리
    extinguishers/         소화기 목록/등록/상세/라벨
    labels/                QR Code 관리 (검색·다중선택·일괄 인쇄, force-dynamic)
    inventory/             수량 현황 (건물×종류 교차표)
    inspections/           전체 점검현황
    lifecycle/             내용연수 관리
    photos/                점검 사진 관리 (조회·삭제·ZIP 다운로드)
    stats/                 통계
    users/                 사용자 관리 (시스템관리자 전용)
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
| `user_sites` | 점검자–사업장 배정 (담당 사업장만 접근) |
| `sites` | 사업장. `org_code`(관리기관 코드) |
| `buildings` | 건물. `site_id`, `building_no` |
| `floors` | 층. `building_id`, `floor_code`, `order_index` |
| `zones` | 구역(선택). `floor_id` |
| `vehicles` | 차량. **건물 소속**(`building_id`), `plate_no`(번호판) |
| `extinguisher_types` | 소화기 종류. `default_useful_life_years`(nullable — CO2/할론 등 내용연수 없음) |
| `extinguishers` | 소화기. `location_type`(BUILDING/VEHICLE), `asset_code`(UNIQUE, 자동생성), `manufacture_date`, `useful_life_years`(nullable), `status` |
| `asset_code_history` | 관리번호 변경 이력 (QR 재발급 없이 옛 코드→최신 소화기 연결) |
| `inspections` | 점검 기록. **append-only**. `inspector_id`, 4개 체크항목, `overall_result`, `inspected_at` |
| `inspection_photos` | 점검 사진 메타. 소화기당 최신 5장만 유지 |

**주요 뷰/함수**
- `v_extinguisher_overview` — 소화기 + 최근 점검 + 계산된 상태 + 전체 위치경로. 목록/대시보드 대부분이 이걸 사용.
- `fn_dashboard_summary()` — 대시보드 집계(이번달 점검/미점검/교체예정/만료/최근 이상).
- `fn_inspection_rate()` — 점검률 통계.
- `fn_submit_inspection(jsonb)` — 점검+사진 원자적 저장 (온라인/오프라인 동기화 공용).
- `fn_find_extinguisher_id_by_code(text)` — 관리번호(현재/과거)로 소화기 id 조회.
- `fn_extinguisher_status`, `fn_kst_today()` — 내용연수 상태(KST 기준) 계산.
- `is_admin()`, `is_super_admin()`, `has_site_access()` — RLS 보안 정의자 헬퍼.

**날짜는 항상 KST(Asia/Seoul) 기준** — `fn_kst_today()`를 쓴다. (UTC로 계산하면 00:00~09:00 사이 하루 오차 발생.)

## QR 관리번호 규칙

- **건물 소화기**: `{관리기관}-{건물번호}-{층코드}-{소화기번호}` (예: `공사-1-1-1`)
- **차량 소화기**: `{관리기관}-{건물번호}-차-{일련번호}` (예: `공사-1-차-1`) — 차량은 건물 소속, 층 대신 `차` 사용
- `asset_code`는 **UNIQUE**, 컴포넌트 컬럼(org_code/building_no/floor_code/extinguisher_no)과 함께 저장.
- 관리번호는 **트리거로 자동 생성**(`pg_advisory_xact_lock`으로 번호 채번 동시성 보장). 상위 코드 변경 시 하위 소화기 번호를 연쇄 재계산.
- **QR은 재발급하지 않는다.** 위치 이동 등으로 관리번호가 바뀌면 옛 코드를 `asset_code_history`에 남겨 옛 QR도 최신 소화기로 연결.
- **층코드는 확장 가능**: 0=지하, R=옥상 등. `차`는 차량 전용 예약어(층 테이블에서 사용 금지).
- QR에는 `asset_code`(또는 `/inspect/{asset_code}` URL)를 인코딩한다.

## Supabase 구조

- **프로젝트 ref**: `nppqfmcrjvipjlcqjajv` / URL `https://nppqfmcrjvipjlcqjajv.supabase.co`
- **리전**: `ap-south-1`(뭄바이) — ⚠️ 한국과 멀어 지연이 있음. [TODO](#앞으로-구현할-기능-todo)의 리전 이전 참고.
- **Auth**: 이메일/비밀번호, **공개 회원가입 없음**. 계정은 시스템관리자가 발급. `handle_new_user` 트리거가 가입 시 profile 자동 생성.
- **Storage**: `inspection-photos` 버킷(점검 사진). 경로에 소화기 id 포함, 소화기당 최신 5장 유지.
- **RLS**: 모든 테이블에 적용. `is_admin()`(admin+super_admin) / `is_super_admin()` / `has_site_access()` 보안 정의자 함수로 판별. `profiles`·`user_sites` 쓰기는 **시스템관리자만**(일반 관리자가 API로 자기 역할을 올리는 것 차단).
- **역할 체계 (3단계)**
  - `super_admin`(시스템관리자): 전체 권한. **사업장 등록·사용자 추가·역할 변경·담당 사업장 배정 독점**. 삭제·강등·비활성 불가(보호). 모든 사업장 접근.
  - `admin`(관리자): **배정된 담당 사업장 범위 내에서만** 건물/층/구역/차량/소화기·점검·대시보드·통계 관리. 사업장 등록/수정/삭제와 사용자 관리는 불가. QR 없이 목록에서 점검 가능(관리자 영역 모달).
  - `inspector`(점검자): 배정된 사업장만 조회. **QR 스캔을 통해서만** 점검. (관리자의 QR 없는 점검도 점검자에게 완료로 반영.)
  - **스코핑 원리**: `has_site_access(site) = is_super_admin() OR user_sites 배정`. 뷰/RPC가 모두 `security invoker`라 이 함수만으로 대시보드·목록·재고까지 배정 사업장으로 자동 한정됨.
- **직접 DB 접속**(마이그레이션/스크립트): 직접 호스트는 IPv6 전용이라 접속 불가할 수 있음 → **Session Pooler**(`aws-1-ap-south-1.pooler.supabase.com:5432`, user `postgres.nppqfmcrjvipjlcqjajv`) 사용.

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

- [ ] **Supabase 리전 이전** (뭄바이 ap-south-1 → 서울 ap-northeast-2) — 로그인/조회 지연 개선. 데이터 이관 필요한 큰 작업.
- [ ] **비밀번호 찾기(재설정) 플로우** — 로그인 화면에 "비밀번호를 잊으셨나요?" + 이메일 재설정. (현재는 시스템관리자/Supabase 대시보드로만 복구 가능)
- [ ] **Zebra 라벨 프린터 연동** — BrowserPrint(ZPL) 직접 출력 + PDF 폴백. (`app/api/labels` 자리 마련됨)
- [ ] **알림** — 미점검/만료 임박 이메일·푸시 (pg_cron + Edge Function). MVP 제외 항목.
- [ ] **점검 이력/통계 내보내기** (Excel/PDF).
- [ ] **네이티브 앱 전환 검토** (Capacitor) — iOS 카메라/딥링크 제약이 커질 경우.

## 변경 이력 (Changelog)

> 형식: `YYYY-MM-DD — 요약`. 기능 추가·수정 시 최신 항목을 위에 추가한다.

- **2026-07-21** — **앱 아이콘·파비콘을 소화기 그림으로 교체.** 기존 임시 빨간 원 대신 소화기 일러스트(빨간 본체·검정 손잡이·호스·노즐)를 적용. `public/icons/icon-192.png`·`icon-512.png`(흰 배경, 여백 14%), `icon-maskable-512.png`(런처가 원형으로 잘라내므로 **안전영역 62%**로 축소 배치), `app/favicon.ico`(투명 배경, 16/32/48/64px 4종 포함). 원본 PNG의 배경은 테두리에서 플러드필로 제거해 소화기만 추출(안쪽 흰 라벨은 보존). 부수: 바탕화면 바로가기용 `extinguisher.ico`(16~256px 6종)를 `%LOCALAPPDATA%\shg-inspector\`에 생성하고 `.url` 바로가기에 연결(로컬 작업, 저장소 무관).
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

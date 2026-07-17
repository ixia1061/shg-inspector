# 소화기 점검 관리 시스템

QR 스캔 기반 소화기 점검·관리 PWA. 점검자는 소화기에 부착된 QR을 스캔해 20~30초 안에 점검을 기록하고,
관리자는 미점검·내용연수 만료 현황을 한눈에 확인한다. 오프라인 점검을 지원한다.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI 기반 `base-nova` 스타일) · Supabase (Postgres/Auth/Storage) · React Hook Form + Zod · html5-qrcode · Dexie (IndexedDB) · Serwist (PWA) · Vercel (호스팅)

---

## 목차

1. [로컬 실행 방법](#1-로컬-실행-방법)
2. [Supabase 설정 방법](#2-supabase-설정-방법)
3. [Git 브랜치 전략 및 배포 워크플로우](#3-git-브랜치-전략-및-배포-워크플로우)
4. [데이터베이스 마이그레이션 방법](#4-데이터베이스-마이그레이션-방법)
5. [환경 변수 레퍼런스](#환경-변수-레퍼런스)
6. [기타](#기타-qr-라벨--오프라인)

---

## 1. 로컬 실행 방법

### 사전 준비

- Node.js 20 이상, Git
- 사용 가능한 Supabase 프로젝트 (아래 [2. Supabase 설정 방법](#2-supabase-설정-방법) 참고)

### 실행 단계

```bash
# 1) 의존성 설치
npm install

# 2) 환경 변수 파일 생성 후 값 채우기
#    (.env.local 은 git 에 커밋되지 않음 — .gitignore 에서 제외됨)
cp .env.local.example .env.local
#    Windows PowerShell: Copy-Item .env.local.example .env.local

# 3) 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속. 로그인 후 관리자/점검자 화면으로 진입한다.

### 같은 네트워크의 휴대폰에서 테스트하기

Next.js 16은 기본적으로 크로스 오리진 개발 리소스 요청을 차단하므로,
PC의 로컬 IP(예: `192.168.0.81`)를 `next.config.ts`의 `allowedDevOrigins`에 추가해야 휴대폰에서 JS가 정상 로드된다.
iOS는 카메라 사용에 HTTPS가 필요하므로, 휴대폰 실기기 테스트는 아래처럼 임시 HTTPS 터널을 쓰는 것이 편하다.

```bash
# 별도 터미널에서 (cloudflared 설치 필요)
cloudflared tunnel --url http://localhost:3000
```

> **운영 환경에서는 이 과정이 필요 없다.** Vercel 배포 URL은 고정 HTTPS 주소라
> 휴대폰에서 바로 접속·PWA 설치가 가능하다.

### 주요 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (Turbopack, PWA 서비스워커 비활성) |
| `npm run build` | 프로덕션 빌드 (`next build --webpack`) |
| `npm run start` | 빌드 결과물로 프로덕션 서버 실행 |
| `npm run lint` | ESLint |

> **왜 `--webpack`인가?** Serwist(PWA 서비스워커)가 아직 Turbopack을 지원하지 않아
> 프로덕션 빌드는 webpack으로 수행한다. 개발 모드(`next dev`)에서는 서비스워커 래핑을 건너뛴다
> (`next.config.ts` 참고). Vercel도 `npm run build`를 실행하므로 이 설정이 그대로 적용된다.

---

## 2. Supabase 설정 방법

### 2-1. 프로젝트 생성

1. [supabase.com](https://supabase.com)에서 새 프로젝트를 생성한다.
2. **Project Settings → API** 에서 다음 3개 값을 확인한다.
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / publishable key** (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret key** (`sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY` (**서버 전용, 절대 클라이언트/깃 노출 금지**)

### 2-2. 스키마 적용

`supabase/migrations/*.sql`을 파일명 순서대로 실행한다. 자세한 절차는
[4. 데이터베이스 마이그레이션 방법](#4-데이터베이스-마이그레이션-방법) 참고.
이어서 기본 소화기 종류 시드를 넣는다.

```sql
-- supabase/seed.sql 내용을 SQL Editor에서 실행
```

### 2-3. Storage 버킷

점검 사진 버킷(`inspection-photos`)과 접근 정책은 `supabase/migrations/20260716120006_storage.sql`에 포함되어
있으므로, 마이그레이션을 모두 적용하면 자동으로 생성된다. 별도 수동 설정이 필요 없다.

### 2-4. 최초 관리자 계정 생성

공개 회원가입이 없으므로 최초 관리자 계정은 수동으로 만든다.

1. Supabase 대시보드 **Authentication → Users → Add user** 로 이메일/비밀번호 계정 생성
2. **SQL Editor** 에서 해당 사용자를 관리자로 승격:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

이후에는 앱의 **사용자 관리** 화면에서 관리자/점검자 계정을 추가 발급할 수 있다.

---

## 3. Git 브랜치 전략 및 배포 워크플로우

### 브랜치 구조

| 브랜치 | 용도 | Vercel 배포 |
|---|---|---|
| `main` | **운영(프로덕션)**. 실제 서비스에 반영되는 버전. 항상 배포 가능한 안정 상태를 유지한다. | **Production** 도메인(`https://shg-inspector.vercel.app`)에 자동 배포 |
| `develop` | **개발 통합**. 기능들을 모아 검증하는 브랜치. | **Preview** 로 자동 배포 (브랜치 URL) |
| `feature/*` | **개별 기능 작업**. `develop`에서 분기해 작업 후 `develop`으로 병합. | push 시 **Preview** 로 자동 배포 (고유 URL) |

흐름: `feature/*` → (병합) → `develop` → (검증 후 병합) → `main` → (자동) 프로덕션 배포

> **원칙: `main`에는 직접 커밋하지 않는다.** 항상 `develop`을 거쳐 검증한 뒤 `main`으로 병합해 릴리스한다.
> 급한 운영 버그(hotfix)만 예외적으로 `main`에서 분기해 고치고, 고친 내용을 `develop`에도 반영한다.

### 3-1. 작업 시작 방법

새 기능/수정은 항상 최신 `develop`에서 `feature` 브랜치를 만들어 시작한다.

```bash
# 1) develop 최신화
git checkout develop
git pull origin develop

# 2) 기능 브랜치 생성 (이름 규칙: feature/설명, 버그수정은 fix/설명)
git checkout -b feature/작업이름      # 예: feature/inspection-export
```

### 3-2. 작업 종료 후 (add · commit · push)

```bash
# 1) 변경사항 스테이징 + 커밋 (커밋 메시지 접두사: feat/fix/docs/chore/perf 권장)
git add -A
git commit -m "feat: 점검 이력 엑셀 내보내기 추가"

# 2) 기능 브랜치를 원격에 push (첫 push는 -u 로 추적 설정)
git push -u origin feature/작업이름

# 3) 검증이 끝나면 develop 에 병합
git checkout develop
git pull origin develop
git merge feature/작업이름
git push origin develop               # → develop Preview 배포 자동 생성

# 4) develop 에서 충분히 확인했다면 운영(main)에 반영 = 릴리스
git checkout main
git pull origin main
git merge develop
git push origin main                  # → 프로덕션 자동 배포

# 5) (선택) 병합이 끝난 기능 브랜치 정리
git branch -d feature/작업이름
git push origin --delete feature/작업이름
```

> GitHub에서 **Pull Request**로 병합해도 된다(변경 리뷰·이력 관리에 유리). `feature/*` push 후
> GitHub가 안내하는 "Compare & pull request"로 `develop`을 대상 브랜치로 PR을 만든다.

### 3-3. Vercel 자동 배포 과정

이 프로젝트는 **GitHub 저장소에 연결된 Vercel 프로젝트**다. 브랜치에 push하면 Vercel이 자동으로 빌드·배포한다.

- **`main` push → 프로덕션 배포**: `https://shg-inspector.vercel.app` 에 반영 (Production Branch = `main`).
- **`develop` / `feature/*` push → 프리뷰 배포**: 실제 서비스에는 영향을 주지 않는 별도 URL로 배포되어
  운영 반영 전에 미리 확인할 수 있다. `develop`의 프리뷰는
  `https://shg-inspector-git-develop-<계정>.vercel.app` 형태의 고정 브랜치 URL로 접근된다.
- 진행 상황·빌드 로그는 Vercel 대시보드 → 프로젝트 → **Deployments** 탭에서 확인한다.
- 빌드 명령은 기본값(`npm run build` = `next build --webpack`)을 사용한다.

> **확인 사항 (최초 1회)**: Vercel 대시보드 → 프로젝트 → **Settings → Git → Production Branch** 가
> `main` 으로 설정돼 있어야 한다. 환경 변수(4개)는 Production·Preview 스코프 모두에 등록해야
> 프리뷰 배포도 정상 동작한다. [환경 변수 레퍼런스](#환경-변수-레퍼런스) 참고.

### 3-4. 롤백 방법 (운영 배포에 문제가 생겼을 때)

**방법 A — Vercel에서 즉시 되돌리기 (가장 빠름, 권장)**
코드 변경 없이 직전 정상 배포로 즉시 전환한다.
1. Vercel 대시보드 → 프로젝트 → **Deployments**
2. 문제 없던 이전 배포를 찾아 **⋯ → Instant Rollback**(또는 **Promote to Production**)
3. 몇 초 내 프로덕션 도메인이 이전 버전으로 복귀한다.

**방법 B — git revert (히스토리 보존, 안전)**
문제된 커밋을 되돌리는 새 커밋을 만들어 push한다. 협업에 안전하다.
```bash
git checkout main
git pull origin main
git revert <되돌릴_커밋_해시>          # 여러 개면 git revert <오래된>..<최신>
git push origin main                  # → 되돌린 상태로 프로덕션 재배포
```
되돌린 내용을 `develop`에도 반영: `git checkout develop && git merge main && git push origin develop`

**방법 C — 특정 커밋으로 강제 이동 (비권장, 최후 수단)**
히스토리를 다시 쓰므로 협업 중에는 위험하다. 단독 작업이고 꼭 필요할 때만 사용한다.
```bash
git checkout main
git reset --hard <되돌릴_커밋_해시>
git push --force-with-lease origin main
```

> DB 스키마를 바꾸는 배포를 롤백할 때는 주의: 코드만 되돌려도 이미 적용된 마이그레이션은 남아 있다.
> 데이터 손상이 우려되면 코드 롤백 전에 DB 상태부터 확인한다.

### 3-5. 브랜치 관리 규칙

- **`main` 직접 push 금지** — 반드시 `develop`을 거쳐 병합한다. `main`은 항상 배포 가능한 상태.
- **브랜치 이름**: 기능은 `feature/설명`, 버그수정은 `fix/설명`, 긴급 운영수정은 `hotfix/설명`.
- **커밋 메시지**: `feat:`, `fix:`, `docs:`, `chore:`, `perf:` 등 접두사를 붙여 목적을 드러낸다.
- **작게 자주** — `feature` 브랜치는 하나의 목적만 담고, 병합 후에는 삭제해 브랜치 목록을 깔끔히 유지한다.
- **병합 전 최신화** — 병합 대상(`develop`/`main`)을 먼저 `pull` 해 충돌을 줄인다.
- **비밀 파일 금지** — `.env.local`, `recovery-codes.txt` 등은 절대 커밋하지 않는다(이미 `.gitignore`로 제외).
- **DB 마이그레이션은 별도** — 코드 배포와 무관하게 DB에도 적용해야 한다.
  [4. 데이터베이스 마이그레이션 방법](#4-데이터베이스-마이그레이션-방법) 참고.

> **환경 변수를 바꿨을 때**: 값은 코드가 아니라 Vercel에 저장되므로, 수정 후 **재배포를 한 번 해야** 반영된다.
> Vercel → **Settings → Environment Variables** 에서 수정 → **Deployments → ⋯ → Redeploy**.

---

## 4. 데이터베이스 마이그레이션 방법

마이그레이션 SQL은 `supabase/migrations/`에 **파일명(타임스탬프) 오름차순**으로 정렬되어 있으며,
반드시 그 순서대로 적용해야 한다(서로 의존).

```
20260716120001_extensions_and_profiles.sql   -- 확장, profiles + 가입 트리거
20260716120002_master_data.sql               -- 사업장/건물/층/구역/차량/사용자-사업장
20260716120003_extinguishers_and_inspections.sql -- 소화기, 관리번호(asset_code) 생성, 점검
20260716120004_views_and_functions.sql       -- 개요 뷰, 대시보드/점검률/점검저장 함수
20260716120005_rls_policies.sql              -- RLS 정책
20260716120006_storage.sql                   -- 점검사진 버킷 + 정책
20260716120007_asset_code_cascade.sql        -- 관리번호 변경 이력·연쇄 갱신 트리거
20260717090001_kst_dates.sql                 -- KST 기준 날짜 함수/상태 계산
20260717090002_vehicles_belong_to_buildings.sql -- 차량을 건물 소속으로, 차량 관리번호
20260717090003_nullable_useful_life.sql      -- 내용연수 없음(CO2/할론 등) 지원
20260717090004_monthly_dashboard.sql         -- 월 1회 점검 기준 대시보드 집계
20260717090005_inspections_site_read.sql     -- 담당 사업장 점검 조회 정책
```

### 방법 A — Supabase SQL Editor (가장 간단, CLI 불필요)

1. Supabase 대시보드 → **SQL Editor**
2. 위 파일들을 **위에서부터 순서대로** 하나씩 열어 내용 전체를 붙여넣고 **Run**
3. 모두 적용한 뒤 `supabase/seed.sql`을 같은 방식으로 실행

> 신규 프로젝트에 처음 적용할 때 권장하는 방법. 각 파일은 독립 실행이 안전하도록 작성되어 있다.

### 방법 B — Supabase CLI

로컬 마이그레이션 폴더를 원격 프로젝트에 그대로 push 한다.

```bash
# Supabase CLI 설치: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref <프로젝트-REF>   # 대시보드 URL의 프로젝트 식별자
supabase db push                              # migrations/ 전체를 순서대로 적용
```

### 방법 C — psql / 직접 연결 (스크립트 자동화용)

직접 호스트(`db.<ref>.supabase.co`)는 IPv6 전용이라 환경에 따라 접속이 안 될 수 있다.
그럴 때는 대시보드 **Connect → Session pooler** 의 연결 문자열(IPv4 지원)을 사용한다.

```bash
# 예시 — 실제 호스트/리전/유저는 대시보드 Connect 화면에서 확인
psql "postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/20260716120001_extensions_and_profiles.sql
# ... 파일별로 순서대로 반복, 마지막에 seed.sql
```

### 새 마이그레이션을 추가할 때

1. `supabase/migrations/`에 `YYYYMMDDHHMMSS_설명.sql` 형식으로 새 파일 생성
   (기존 파일은 수정하지 않고 항상 새 파일로 변경분을 쌓는다)
2. 로컬/원격에 적용해 검증
3. 커밋 후 push → Vercel 자동 재배포. (마이그레이션은 앱 배포와 별개이므로 DB에도 반드시 적용할 것)

---

## 환경 변수 레퍼런스

`.env.local.example` 참고. 로컬은 `.env.local`, 운영은 Vercel Environment Variables에 설정한다.

| 변수 | 공개 여부 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트 노출 | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트 노출 | anon/publishable key. RLS로 보호되므로 노출되어도 안전 |
| `NEXT_PUBLIC_APP_URL` | 클라이언트 노출 | QR 라벨에 인코딩할 절대 URL의 origin |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용** | 관리자 기능(사용자 생성, 사진 일괄 관리 등)에 사용. **절대 클라이언트/깃에 노출 금지** |

`NEXT_PUBLIC_` 접두사가 붙은 변수만 브라우저 번들에 포함된다. `SUPABASE_SERVICE_ROLE_KEY`는
접두사가 없어 서버(서버 액션/라우트 핸들러)에서만 접근 가능하며, `lib/supabase/admin.ts`가 `server-only`로 보호한다.

---

## 기타: QR 라벨 · 오프라인

### QR 라벨 인쇄 (Zebra 프린터)

관리자 PC에 Zebra **Browser Print** 유틸리티를 설치하면 소화기 상세 → QR/라벨 화면에서 바로 라벨 프린터로 인쇄할 수 있다.
미설치 시에는 브라우저 인쇄 대화상자(PDF)로 대체 가능하다.

### 오프라인 점검

점검자 화면은 온라인일 때 서버에 즉시 저장하고, 오프라인일 때는 IndexedDB(Dexie) Outbox에 저장한 뒤
온라인 복귀 시 자동으로 동기화한다(`lib/offline/`). 또한 온라인 상태로 앱을 한 번 열어두면 담당 사업장의
소화기 정보가 미리 캐시되어, 지하실 등 신호가 없는 곳에서도 QR 스캔 후 즉시 점검할 수 있다.
오프라인 테스트는 Chrome DevTools의 Network → Offline으로 확인한다.

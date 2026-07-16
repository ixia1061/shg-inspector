# 소화기 점검 관리 시스템

QR 스캔 기반 소화기 점검·관리 PWA. 설계 배경은 `docs`가 아니라 대화 이력의 설계서를 참고할 것.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI 기반 `base-nova` 스타일) · Supabase (Postgres/Auth/Storage) · React Hook Form + Zod · html5-qrcode · Dexie (IndexedDB) · Serwist (PWA)

## 최초 설정

1. **의존성 설치**

   ```bash
   npm install
   ```

2. **Supabase 프로젝트 준비**

   - [supabase.com](https://supabase.com)에서 새 프로젝트 생성
   - `supabase/migrations/*.sql` 파일을 **파일명 순서대로** SQL Editor에서 실행 (또는 Supabase CLI 연결 후 `supabase db push`)
   - `supabase/seed.sql` 실행 (기본 소화기 종류 시드)
   - Project Settings → API 에서 Project URL, anon key, service_role key 확인

3. **환경 변수 설정**

   `.env.local.example`을 `.env.local`로 복사하고 값 채우기:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   SUPABASE_SERVICE_ROLE_KEY=   # 서버 전용, 사용자 관리 기능에 필요
   ```

4. **최초 관리자 계정 생성**

   공개 회원가입이 없으므로 최초 관리자 계정은 Supabase 대시보드(Authentication → Users → Add user)에서 직접 생성한 뒤,
   `profiles` 테이블에서 해당 사용자의 `role`을 `admin`으로 수정한다. 이후 사용자 관리 화면에서 추가 계정을 발급할 수 있다.

5. **개발 서버 실행**

   ```bash
   npm run dev
   ```

## 주요 명령어

- `npm run dev` — 개발 서버 (Turbopack, PWA 서비스워커는 비활성화됨)
- `npm run build` — 프로덕션 빌드 (`--webpack`; Serwist가 아직 Turbopack을 지원하지 않아 webpack으로 빌드)
- `npm run lint` — ESLint

## QR 라벨 인쇄 (Zebra 프린터)

관리자 PC에 Zebra의 **Browser Print** 유틸리티를 설치하면 소화기 상세 → QR/라벨 화면에서 바로 라벨 프린터로 인쇄할 수 있다.
설치 전에는 "PDF로 인쇄" 버튼(브라우저 인쇄 대화상자)으로 대체 가능하다.

## 오프라인 점검

점검자 화면은 온라인일 때 서버에 즉시 저장하고, 오프라인일 때는 IndexedDB(Dexie) Outbox에 저장한 뒤
온라인 복귀 시 자동으로 동기화한다 (`lib/offline/`). 오프라인 테스트는 Chrome DevTools의 Network → Offline으로 확인한다.

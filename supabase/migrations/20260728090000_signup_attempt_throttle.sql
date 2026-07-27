-- 가입코드를 4자리로 줄이면서 무작위 대입(brute force)을 막기 위한 시도 기록.
--
-- 4자리(혼동 없는 32자 알파벳)는 약 105만 조합이라 사람이 찍기는 어렵지만,
-- 자동 스크립트라면 시도할 수 있다. 같은 접속지에서 짧은 시간에 실패가 반복되면 막는다.
--
-- 앱은 이 테이블을 직접 읽거나 쓰지 않는다. 가입 서버 액션이 service_role로만 다루므로
-- RLS를 켜고 정책은 하나도 두지 않는다(= 일반 사용자 전원 접근 불가).
create table public.signup_attempts (
  id bigserial primary key,
  ip text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index idx_signup_attempts_ip_time on public.signup_attempts (ip, attempted_at desc);

alter table public.signup_attempts enable row level security;

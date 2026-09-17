"use client";

import { useState } from "react";

/**
 * 클라이언트 페이지네이션 공용 훅 — page/pageCount/pageRows 계산을 한 곳에 모은다.
 * (여러 목록 컴포넌트에 거의 똑같은 계산이 복붙돼 있던 것을 정리)
 *
 * resetKey를 주면 그 값이 바뀔 때 렌더 중에 즉시 1페이지로 되돌린다 — useEffect로
 * 되돌리면 "새 데이터 + 옛 페이지" 조합이 한 프레임 보였다가 바뀌는 깜빡임이 생기는데,
 * 렌더 중 조정은 그 프레임 없이 바로 반영된다. rows를 필터링해 만드는 배열은
 * 보통 useMemo로 감싸 그 필터 조건이 바뀔 때만 참조가 바뀌므로, 그 배열 자체를
 * resetKey로 넘기면 된다(참조 비교이므로 매 렌더 새로 만들어지는 배열엔 쓰지 말 것).
 * resetKey를 생략하면 페이지 리셋은 호출부가 직접 setPage(0)로 처리한다
 * (URL과 페이지를 동기화하는 등 더 세밀한 제어가 필요할 때).
 */
export function usePagination<T>(rows: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(0);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== undefined && resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(0);
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);

  return { page: current, setPage, pageCount, pageRows };
}

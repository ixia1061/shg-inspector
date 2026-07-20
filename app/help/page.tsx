import { HelpCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { BackButton } from "@/components/shared/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/utils/roles";
import { APP_VERSION } from "@/lib/version";

/**
 * 도움말 페이지. 로그인한 사용자의 역할에 따라 내용을 나눈다.
 * - 관리자/시스템관리자: 관리 기능 사용법
 * - 점검자: 현장 점검 방법만
 */
export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = isAdminRole(profile?.role);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-6" />
          <h1 className="text-2xl font-bold">도움말</h1>
        </div>
        <BackButton />
      </div>

      {isAdmin ? <AdminHelp /> : <InspectorHelp />}

      <p className="text-muted-foreground text-center text-xs">
        소화기 점검 관리 시스템 · Ver {APP_VERSION}
      </p>
    </div>
  );
}

/** 점검자용: 현장 점검 방법만 */
function InspectorHelp() {
  return (
    <>
      <p className="text-muted-foreground text-sm">
        소화기 점검 방법 안내입니다. 점검은 소화기에 부착된 <b>QR 코드를 직접 스캔</b>해야
        시작됩니다.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>QR 점검 순서</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ol className="ml-4 flex list-decimal flex-col gap-1">
            <li><b>[카메라 시작]</b> 을 누르고 카메라 권한을 허용합니다.</li>
            <li>소화기의 <b>QR 코드</b>를 사각형 안에 비춥니다 → 점검 화면으로 자동 이동.</li>
            <li>소화기 정보(관리번호·위치)가 맞는지 확인합니다.</li>
            <li>문제가 있는 항목만 <b>체크를 해제</b>합니다(모두 정상이면 그대로 둡니다).</li>
            <li>필요하면 <b>비고</b>를 적고 <b>카메라 버튼</b>으로 사진을 찍습니다(최대 5장).</li>
            <li><b>[점검완료]</b> 를 누르면 저장됩니다.</li>
            <li><b>[다음 소화기 스캔]</b> 으로 반복합니다.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>점검 항목</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          압력 정상 · 봉인 정상 · 외관 정상 · 설치상태 정상 — 처음에는 모두 정상으로 체크되어
          있습니다. 문제가 있는 항목만 체크를 풀면 그 항목이 <b>불량</b>으로 기록되고, 하나라도
          풀리면 결과가 <b>"이상"</b> 으로 저장됩니다.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR이 안 잡힐 때</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          휴대폰을 소화기에서 10~20cm 떨어뜨리고 밝은 곳에서 QR을 사각형 안에 비춥니다.
          <b>[다시 시도]</b> 를 누르거나 앱을 껐다 켜 보세요. QR 라벨이 손상·오염됐다면
          <b>관리자에게 라벨 재발급</b>을 요청하세요. (점검은 QR 스캔으로만 가능합니다)
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>카메라 권한이 거부됐을 때</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          브라우저/휴대폰 설정에서 이 사이트(앱)의 <b>카메라 권한을 허용</b>한 뒤 앱을 다시 실행하고
          <b>[카메라 시작]</b> 을 누릅니다. (아이폰은 사파리로 "홈 화면에 추가"한 앱에서만 카메라가
          정상 동작합니다)
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>인터넷이 안 될 때 (오프라인)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          지하 등 인터넷이 없는 곳에서도 <b>평소처럼 점검·저장</b>할 수 있습니다. 내용은 휴대폰에
          임시 저장되고, 인터넷이 되는 곳으로 나오면 <b>자동으로 저장(동기화)</b> 됩니다. 동기화가
          끝나기 전에는 앱 데이터를 지우지 마세요.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사진 저장이 안 될 때</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          점검은 사진이 없어도 저장됩니다. 저장이 급하면 사진을 빼고 먼저 <b>[점검완료]</b> 를
          누르세요. 사진은 최대 5장까지 첨부됩니다.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>문의</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          해결되지 않으면 사용 기기·화면 이름·<b>관리번호</b>·오류 메시지·발생 시각을 정리해
          관리자에게 문의하세요.
        </CardContent>
      </Card>
    </>
  );
}

/** 관리자용: 관리 기능 사용법 */
function AdminHelp() {
  return (
    <>
      <p className="text-muted-foreground text-sm">
        소화기 등록부터 점검 현황·관리대장·QR 라벨까지, 관리 기능 전체 안내입니다. 접속 주소는{" "}
        <span className="font-medium">shg-inspector.vercel.app</span> 이며, 문제가 생기면 맨 아래
        <b>문제 해결</b>을 참고하세요.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>시작하기 (접속 · 로그인 · 앱 설치)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li>브라우저에서 <b>shg-inspector.vercel.app</b> 접속 → 발급받은 <b>이메일·비밀번호</b>로 로그인.</li>
            <li>공개 회원가입은 없습니다. 계정은 <b>시스템관리자</b>가 발급합니다.</li>
            <li>휴대폰 브라우저 메뉴의 <b>홈 화면에 추가</b>를 누르면 앱처럼 설치됩니다.</li>
            <li>
              <b>내 권한 범위</b>: 일반 관리자는 <b>배정된 담당 사업장</b>만 보고 관리합니다. 사업장
              추가·사용자 관리는 시스템관리자 전용입니다.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>메뉴 한눈에 보기</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>대시보드</b>: 이번 달 점검·미점검, 교체예정·만료, 최근 이상 점검 요약</li>
            <li><b>사업장/건물 관리</b>: 건물·층·차량 등록/수정 (사업장 추가는 시스템관리자)</li>
            <li><b>소화기 관리</b>: 등록·수정·삭제, 검색(관리번호·제조번호·위치), 상세·점검이력</li>
            <li><b>수량 현황</b>: 사업장별 건물×종류 소화기 수량 교차표</li>
            <li><b>점검현황</b>: 사업장별 미점검/점검완료, 건물별 점검률, 관리대장(엑셀) 다운로드</li>
            <li><b>내용연수 관리</b>: 교체 예정·만료 소화기 목록</li>
            <li><b>사진 관리</b>: 점검 사진 조회·삭제·ZIP 다운로드</li>
            <li><b>통계</b>: 점검자별 실적, 건물별 점검률</li>
            <li><b>QR Code 관리</b>: 라벨 검색·다중선택·인쇄(재발급)</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>대시보드 보는 법</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li>
              <b>이번 달 점검/미점검</b>: 이번 달에 점검이 끝난/남은 소화기 수. 매월{" "}
              <b>1일(한국시간)</b> 에 초기화됩니다.
            </li>
            <li>
              <b>교체예정·만료</b>: 내용연수(제조일 기준)로 자동 계산. CO2·할론처럼 내용연수가 없는
              종류는 제외됩니다.
            </li>
            <li><b>건물별 점검률</b>: 담당 사업장의 건물별 이번 달 점검 진행률.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사업장 · 건물 · 층 · 차량 관리</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>사업장/건물 관리</b>에서 사업장 안에 <b>건물 → 층</b>을 등록하고 층 순서를 조정합니다.</li>
            <li><b>차량</b>은 건물에 소속시켜 등록하며 번호판·차종·관리부서를 입력합니다.</li>
            <li>관리번호는 자동 생성 — 건물: <b>기관-건물-층-번호</b>, 차량: <b>기관-건물-차-번호</b>.</li>
            <li>사업장 자체의 추가/수정/삭제는 <b>시스템관리자</b>만 가능합니다.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>소화기 등록</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <b>소화기 관리 → 등록</b>에서 입력합니다.
          <ul className="mt-1 ml-4 flex list-disc flex-col gap-1">
            <li><b>위치</b>: 건물 소화기(건물/층/설치위치) 또는 차량 소화기(차량 선택)</li>
            <li><b>종류·용량</b> (예: 분말 3.3kg)</li>
            <li><b>제조년월</b>: 명판 기준 <b>연·월만</b>(예: 2026-12) — 자동으로 그 달 1일로 저장</li>
            <li><b>제조번호</b>(선택), <b>내용연수</b>(분말 등만, 없는 종류는 비움)</li>
            <li><b>관리번호 끝자리</b>(선택): 비우면 자동 부여, 지정하면 그 번호로 등록</li>
          </ul>
          <p className="mt-2">
            <b>QR 라벨은 재발급하지 않습니다.</b> 위치가 바뀌어 관리번호가 변경돼도 옛 QR이 최신
            소화기로 연결됩니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>소화기 검색 · 수정 · 직접 점검</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li>목록에서 <b>관리번호·제조번호·위치</b>로 검색하고, 사업장·상태로 필터합니다.</li>
            <li>소화기 상세에서 정보를 수정하거나 점검 이력을 확인합니다.</li>
            <li>
              <b>관리자 직접 점검</b>: 목록/상세의 <b>[점검]</b> 버튼으로 QR 없이 점검을 기록할 수
              있습니다(관리자 전용). 점검자 점검과 동일하게 완료로 반영됩니다.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>소화기 삭제 (폐기·철수)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          소화기 상세 화면의 <b>[삭제]</b> → 확인창에 <b>관리번호를 정확히 입력</b>해야 삭제됩니다.
          <b>되돌릴 수 없으며</b> 점검 이력·사진까지 함께 영구 삭제되니, 실제로 폐기·철수한 소화기에만
          사용하세요.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>점검현황 · 관리대장 다운로드</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li>상단 <b>사업장 버튼</b>을 누르면 그 사업장 기준으로 전환됩니다.</li>
            <li><b>이번달 미점검 / 점검완료</b> 탭으로 목록을, 건물별 점검률을 확인합니다.</li>
            <li>오른쪽 위 <b>[○○○ 관리대장]</b> 버튼으로 그 사업장의 엑셀(.xlsx) 대장을 내려받습니다.</li>
            <li>점검/미점검 기준은 매월 <b>1일(한국시간)</b> 에 초기화됩니다.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>수량 현황 · 내용연수 · 사진 · 통계</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>수량 현황</b>: 사업장 버튼으로 전환, 건물×종류 교차표로 보유 수량 파악.</li>
            <li><b>내용연수 관리</b>: 교체 예정·만료 소화기를 교체예정일 순으로 확인.</li>
            <li><b>사진 관리</b>: 점검 사진 조회·삭제, 관리번호별 <b>ZIP 다운로드</b>. 소화기당 최신 5장 유지.</li>
            <li><b>통계</b>: 이번 달 점검자별 실적, 건물별 점검률.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR 라벨 인쇄 · 재발급</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li>
              <b>QR Code 관리</b>에서 소화기를 검색·<b>다중 선택</b> → 라벨 크기와 위치 표시 여부를 골라
              <b>한 장씩</b> 인쇄합니다.
            </li>
            <li>새로 등록했는데 안 보이면 <b>[새로고침]</b> 버튼을 누르세요.</li>
            <li>
              점검자가 "QR 라벨이 손상됐다"고 하면 여기서 해당 소화기 라벨을 <b>다시 인쇄</b>해 부착합니다
              (관리번호·QR 내용은 동일).
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>문제 해결 (자주 발생하는 오류)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>로그인 실패</b>: 이메일·비밀번호 확인. 점검자 계정 문제는 사용자 관리에서 상태(활성) 확인.</li>
            <li><b>최신 내용이 안 보임</b>: 화면 새로고침(QR Code 관리는 [새로고침] 버튼). 앱이면 껐다 켜기.</li>
            <li><b>관리번호 중복 오류</b>: 등록 시 끝자리를 비워 자동 부여되게 하세요.</li>
            <li><b>점검자가 QR이 안 잡힌다고 함</b>: 라벨 손상일 수 있으니 QR Code 관리에서 재인쇄.</li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

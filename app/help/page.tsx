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
        소화기 점검 관리 시스템 · 버전 {APP_VERSION}
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
        소화기 등록·점검 현황·관리대장 등 관리 기능 안내입니다. 접속 주소는{" "}
        <span className="font-medium">shg-inspector.vercel.app</span> 입니다.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>주요 메뉴</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>대시보드</b>: 이번 달 점검/미점검·교체예정·만료 요약</li>
            <li><b>사업장/건물 관리</b>: 건물·층·차량 등록 (사업장 추가는 시스템관리자)</li>
            <li><b>소화기 관리</b>: 등록·수정·삭제·검색(관리번호·제조번호·위치)</li>
            <li><b>수량 현황</b>: 건물×종류별 소화기 수량</li>
            <li><b>점검현황</b>: 사업장별 미점검/점검완료 + 관리대장(엑셀) 다운로드</li>
            <li><b>내용연수 관리</b>: 교체 예정·만료 소화기</li>
            <li><b>사진 관리 / 통계 / QR Code 관리</b>: 사진·통계·라벨 인쇄</li>
            <li><b>사용자 관리</b>(시스템관리자): 계정·역할·담당 사업장 배정</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>소화기 등록</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <b>소화기 관리 → 등록</b>에서 위치(건물/차량)·종류·용량·<b>제조년월(연·월만)</b>·제조번호·
          내용연수를 입력합니다. 관리번호는 자동으로 만들어지며, 끝자리를 비우면 자동 부여됩니다.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>점검 현황 · 관리대장</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <b>점검현황</b>에서 사업장 버튼을 누르면 그 사업장의 <b>이번달 미점검/점검완료</b>와 건물별
          점검률을 봅니다. 오른쪽 위 <b>[○○○ 관리대장]</b> 버튼으로 사업장별 엑셀 관리대장을
          내려받습니다. 점검/미점검 기준은 <b>매월 1일(한국시간)</b> 에 초기화됩니다.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR 라벨 인쇄 · 재발급</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <b>QR Code 관리</b>에서 소화기를 검색·다중 선택하고 라벨 크기를 골라 한 장씩 인쇄합니다.
          점검자의 QR 라벨이 손상됐다는 요청을 받으면 여기서 해당 소화기 라벨을 다시 인쇄해
          주세요.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>소화기 삭제(폐기·철수)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          소화기 상세 화면의 <b>[삭제]</b> → 관리번호를 정확히 입력해야 삭제됩니다. 되돌릴 수 없고
          점검 이력·사진까지 함께 삭제되니 실제 폐기·철수한 소화기에만 사용하세요.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>자주 발생하는 오류</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>로그인 실패</b>: 이메일·비밀번호 확인. 점검자 계정 문제는 사용자 관리에서 확인.</li>
            <li><b>최신 반영 안 됨</b>: 화면 새로고침(QR Code 관리는 [새로고침] 버튼).</li>
            <li><b>관리번호 중복</b>: 등록 시 끝자리를 비워 자동 부여되게 하세요.</li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

"use client";

import { ArrowLeft, HelpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_VERSION } from "@/lib/version";

/**
 * 앱 내 도움말 페이지. 점검자·관리자 모두, 그리고 로그인 전에도 볼 수 있다(공개 경로).
 * 오프라인·CSP 환경에서도 동작하도록 외부 링크 없이 내용을 자체 포함한다.
 */
export default function HelpPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-6" />
          <h1 className="text-2xl font-bold">도움말</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" /> 뒤로
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        소화기 점검 관리 시스템 사용 안내입니다. 접속 주소는{" "}
        <span className="font-medium">shg-inspector.vercel.app</span> 이며, 로그인 계정은
        시스템관리자가 발급합니다.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>점검자 — QR 점검 순서</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ol className="ml-4 flex list-decimal flex-col gap-1">
            <li><b>[카메라 시작]</b> 을 누르고 카메라 권한을 허용합니다.</li>
            <li>소화기의 <b>QR 코드</b>를 사각형 안에 비춥니다 → 점검 화면으로 자동 이동.</li>
            <li>소화기 정보(관리번호·위치)가 맞는지 확인합니다.</li>
            <li>문제가 있는 항목만 <b>체크를 해제</b>합니다(모두 정상이면 그대로).</li>
            <li>필요하면 <b>비고</b>를 적고 <b>카메라 버튼</b>으로 사진을 찍습니다(최대 5장).</li>
            <li><b>[점검완료]</b> 를 누르면 저장됩니다.</li>
            <li><b>[다음 소화기 스캔]</b> 으로 반복합니다.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR이 손상됐을 때</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          QR 스캔 화면에서 <b>[QR이 손상됐나요? 관리번호 직접 입력]</b> 을 누르고, 라벨에 적힌
          관리번호(예: 공사-1-1-1)를 입력한 뒤 <b>[점검 시작]</b> 을 누르면 스캔한 것과 똑같이
          점검할 수 있습니다.
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
          <CardTitle>관리자 — 주요 메뉴</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>대시보드</b>: 이번 달 점검/미점검·교체예정·만료 요약</li>
            <li><b>사업장/건물 관리</b>: 건물·층·차량 등록 (사업장 추가는 시스템관리자)</li>
            <li><b>소화기 관리</b>: 등록·수정·삭제·검색(관리번호·제조번호·위치)</li>
            <li><b>점검현황</b>: 사업장별 미점검/점검완료 + 관리대장(엑셀) 다운로드</li>
            <li><b>내용연수 관리</b>: 교체 예정·만료 소화기</li>
            <li><b>사진 관리 / 통계 / QR Code 관리</b>: 사진·통계·라벨 인쇄</li>
            <li><b>사용자 관리</b>(시스템관리자): 계정·역할·담당 사업장 배정</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>자주 발생하는 오류</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="ml-4 flex list-disc flex-col gap-1">
            <li><b>로그인 실패</b>: 이메일·비밀번호 확인 → 안 되면 시스템관리자에게 계정 상태 문의.</li>
            <li><b>QR 안 잡힘</b>: 10~20cm 거리, 밝은 곳. 손상됐으면 <b>관리번호 직접 입력</b>.</li>
            <li><b>카메라 권한</b>: 브라우저/휴대폰 설정에서 카메라 허용 후 앱 재실행. (아이폰은 사파리)</li>
            <li><b>사진 저장 실패</b>: 사진을 빼고 먼저 <b>[점검완료]</b> → 점검은 사진 없이도 저장됨.</li>
            <li><b>최신 반영 안 됨</b>: 화면 <b>새로고침</b> 또는 앱 재실행.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>문의</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          위 방법으로 해결되지 않으면 사용 기기·화면 이름·<b>관리번호</b>·오류 메시지·발생 시각을
          정리해 시스템관리자에게 문의하세요. 자세한 사용설명서(설치·점검·관리)는 배포 담당자가
          제공하는 매뉴얼 문서를 참고하세요.
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-center text-xs">
        소화기 점검 관리 시스템 · 버전 {APP_VERSION}
      </p>
    </div>
  );
}

import { OfficialItem } from "./types";

// data.go.kr 정책뉴스 API 키가 도착하기 전까지 파이프라인·화면 개발용으로 쓰는 목업 데이터.
// 실제 키 연동 후에는 lib/match/policyNewsClient.ts가 이 목업 대신 실API 응답을 사용하도록 자동 전환된다.
export const MOCK_OFFICIAL_ITEMS: OfficialItem[] = [
  {
    id: "mock-1",
    contentType: "사실확인",
    title: "'65세 이상 전원에게 50만원 지급' 은 사실이 아닙니다",
    body:
      "최근 SNS와 카카오톡을 통해 '65세 이상 전원에게 50만원을 지급한다'는 내용이 확산되고 있으나, 이는 사실이 아닙니다. " +
      "보건복지부는 해당 지원금 정책을 추진하거나 발표한 바 없습니다. 유사한 안내를 받으신 경우 공식 채널을 통해 다시 확인해 주시기 바랍니다.",
    agency: "보건복지부",
    date: "2026-08-10",
    url: "https://korea.kr/briefing/actuallyList.do?example=1",
  },
  {
    id: "mock-2",
    contentType: "사실확인",
    title: "유명 배우 사칭 투자 리딩방 광고, 공식 협찬·보증 아닙니다",
    body:
      "특정 유명 배우가 고수익 투자를 보증한다는 SNS 광고·영상이 유포되고 있으나, 이는 해당 배우 및 소속사, 정부 기관과 무관한 사칭 사기입니다. " +
      "금융위원회는 이러한 투자 리딩방에 대해 각별한 주의를 당부합니다.",
    agency: "금융위원회",
    date: "2026-07-22",
    url: "https://korea.kr/briefing/actuallyList.do?example=2",
  },
  {
    id: "mock-3",
    contentType: "보도자료",
    title: "2026년 하반기 에너지바우처 지원 대상·지급 일정 안내",
    body:
      "산업통상부는 2026년 하반기 에너지바우처 지원 대상 가구와 지급 일정을 안내했다. 지원 대상은 소득기준 및 세대원 특성을 고려해 선정된다.",
    agency: "산업통상부",
    date: "2026-08-05",
    url: "https://korea.kr/briefing/pressReleaseView.do?example=3",
  },
];

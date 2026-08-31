import { EvidenceIssue } from "../types";

const KNOWN_CITIES = new Set([
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "수원시", "용인시", "고양시", "화성시", "성남시", "부천시", "남양주시", "안산시", "평택시", "안양시", "시흥시", "파주시", "김포시", "의정부시", "광주시", "하남시", "광명시", "군포시", "양주시", "오산시", "이천시", "안성시", "구리시", "의왕시", "포천시", "여주시", "동두천시", "과천시",
  "춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "청주시", "충주시", "제천시", "천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시",
  "전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "목포시", "여수시", "순천시", "나주시", "광양시",
  "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "제주시", "서귀포시",
]);

const MOIS_SOURCE = {
  title: "행정안전부 지방자치단체 행정구역 및 인구 현황",
  url: "https://www.mois.go.kr/frt/sub/a05/totStat/screen.do",
};

export function verifyKoreanPlaces(text: string): EvidenceIssue[] {
  const candidates = [...text.matchAll(/([가-힣]{2,10}시)(?=가|는|에서|의|에|,|\s)/g)].map((match) => match[1]);
  const unique = [...new Set(candidates)];
  return unique
    .filter((name) => !KNOWN_CITIES.has(name) && !isGenericWord(name))
    .map((name) => ({
      phrase: name,
      reason: `‘${name}’는 대한민국의 특별시·광역시·특별자치시 또는 기초자치단체 시 목록에서 확인되지 않습니다. 실제 지자체를 지칭한 기사라면 명칭이 잘못됐거나 가상으로 작성됐을 가능성이 높습니다.`,
      sources: [MOIS_SOURCE],
    }));
}

export function verifyContextualPlaces(claimText: string, documentText: string): EvidenceIssue[] {
  const direct = verifyKoreanPlaces(claimText);
  if (direct.length > 0) return direct;

  return verifyKoreanPlaces(documentText).map((issue) => {
    const cityStem = issue.phrase.replace(/시$/, "");
    const derivedName = claimText.match(new RegExp(`${cityStem}[가-힣A-Za-z0-9]+`))?.[0];
    if (derivedName) {
      return {
        phrase: derivedName,
        reason: `‘${derivedName}’는 공식 목록에서 확인되지 않는 ‘${issue.phrase}’를 전제로 만든 명칭입니다. 해당 지자체가 존재하지 않으므로 그 지역화폐·시청·기관에 관한 주장도 성립하지 않습니다.`,
        sources: issue.sources,
      };
    }
    return {
      phrase: issue.phrase,
      reason: `이 문장은 기사 앞부분의 ‘${issue.phrase}’가 실제 지방자치단체라는 전제에 의존합니다. 해당 명칭이 공식 행정구역 목록에 없으므로 지급 정책·신청 절차·예산·관계자 발표도 실제 정책으로 볼 근거가 없습니다.`,
      sources: issue.sources,
    };
  });
}

function isGenericWord(value: string): boolean {
  return ["도시", "신도시", "혁신도시", "광역시", "특별시", "자치시"].some((word) => value.endsWith(word));
}

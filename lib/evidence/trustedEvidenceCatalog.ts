import { EvidenceIssue, EvidenceSource } from "../types";

interface CatalogEntry extends EvidenceSource {
  snippet: string;
  matches: (text: string) => boolean;
}

// 반복적으로 검증되는 공익·건강 주제의 1차/학술 근거를 로컬에서도 조회할 수 있게 보관한다.
// 모델의 사전지식이 아니라 공개된 원문의 요지를 기록한 것이며 URL을 항상 함께 노출한다.
const CATALOG: CatalogEntry[] = [
  {
    title: "관세청 「2026년 7월 기업규모별 수출입 현황」",
    url: "https://m.korea.kr/briefing/pressReleaseView.do?gubun=pressRelease&newsId=156775588&pageIndex=1&repCode=nts",
    snippet: "2026년 7월 전체 수출액은 990억 달러로 전년 동월 대비 63.0% 증가했다. 대기업 수출은 744억 달러로 90.7%, 중견기업은 127억 달러로 8.7%, 중소기업은 117억 달러로 17.9% 증가했다.",
    matches: (text) => /2026년\s*7월/.test(text) && /수출|수입|기업규모/.test(text),
  },
  {
    title: "Caffeine No Substitute for a Nap to Enhance Memory",
    url: "https://www.nimh.nih.gov/news/science-updates/2008/caffeine-no-substitute-for-a-nap-to-enhance-memory",
    snippet: "미국 국립정신건강연구소가 소개한 연구에서는 커피 2~3잔 상당의 카페인이 운동학습과 단어 회상을 악화시켰고, 수면을 대신할 수 없다고 설명한다.",
    matches: (text) => /커피|카페인/.test(text) && /기억|시험|업무|인지/.test(text),
  },
  {
    title: "EFSA: Caffeine safety guidance",
    url: "https://www.efsa.europa.eu/en/topics/topic/caffeine",
    snippet: "유럽식품안전청은 건강한 성인의 모든 공급원 합산 카페인 섭취가 하루 400mg 이하일 때 일반적으로 안전 우려가 없다고 설명한다. 이는 기억력 향상을 위한 권고량이 아니다.",
    matches: (text) => /커피|카페인/.test(text) && /하루|잔|섭취|권고/.test(text),
  },
  {
    title: "Coffee consumption and cognitive decline: the FINE Study",
    url: "https://www.nature.com/articles/1602495",
    snippet: "고령 남성 관찰연구에서는 커피 섭취와 인지 저하가 J자형 관계를 보였고, 인지 저하가 가장 적은 수준은 하루 3잔이었다. 시험 전 5~6잔 섭취를 권고한 연구가 아니다.",
    matches: (text) => /커피/.test(text) && /기억|인지|연구/.test(text),
  },
];

export function findTrustedEvidence(text: string) {
  return CATALOG.filter((entry) => entry.matches(text)).map(({ title, url, snippet }) => ({ title, url, snippet }));
}

export function verifyHighDoseCoffeeAdvice(text: string): EvidenceIssue[] {
  const highDose = /(?:하루\s*)?5\s*[~～\-–]\s*6\s*잔|(?:하루\s*)?[56]\s*잔\s*(?:이상)?/.test(text);
  const advice = /권고|추천|마시(?:는|면)|섭취/.test(text);
  const cognition = /기억력|인지|시험|중요한 업무/.test(text);
  if (!highDose || !advice || !cognition) return [];

  const sources = findTrustedEvidence(text).map(({ title, url }) => ({ title, url }));
  return [{
    phrase: text.match(/하루\s*5\s*[~～\-–]\s*6\s*잔[^.”"]*/)?.[0] ?? "하루 5~6잔의 커피를 섭취하는 것이 기억력 향상에 도움이 된다",
    reason: "확인된 연구와 안전 지침은 시험·중요 업무 전 하루 5~6잔을 기억력 향상 방법으로 권고하지 않습니다. 일부 연구는 커피와 인지 기능의 연관성을 다루지만 대상과 조건이 다르며, 관찰된 최적 수준도 3잔이었습니다. 따라서 이 문장의 ‘연구진 권고’와 섭취량은 근거와 일치하지 않습니다.",
    sources,
  }];
}

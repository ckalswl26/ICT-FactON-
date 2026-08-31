import { EvidenceIssue } from "../types";

const MIN_WAGE_2027_SOURCE = {
  title: "최저임금위원회 「2027년 적용 최저임금 고시」",
  url: "https://www.minimumwage.go.kr/",
};
const CORRECT_WON = 10700; // 2027년도 시간당 최저임금(고시 금액)

function parseWon(token: string): number | null {
  const m = token.match(/(\d+)\s*만\s*(\d+)?\s*원/);
  if (!m) return null;
  return Number(m[1]) * 10000 + Number(m[2] || 0);
}

// AI 판정에만 맡기면(웹검색 결과 제목에 정답이 있어도) 놓치는 경우가 실측으로 확인돼,
// 관세청 무역통계 검증(verifyTradeStatistics.ts)과 같은 방식으로 결정론적으로 먼저 대조한다.
// phrase는 반드시 claimText 원문의 exact substring이어야 화면에서 그 부분을 그대로
// 하이라이트할 수 있어, 문맥 없이 숫자 토큰(\d+만\d*원)만 그대로 뽑는다.
export function verifyMinimumWage2027(claimText: string, documentText: string): EvidenceIssue[] {
  const context = `${documentText}\n${claimText}`;
  if (!/2027년/.test(context) || !/최저임금/.test(context)) return [];

  const match = claimText.match(/\d+\s*만\s*\d*\s*원/);
  if (!match) return [];

  const amount = parseWon(match[0]);
  if (amount === null || amount === CORRECT_WON) return [];

  return [{
    phrase: match[0],
    reason: `2027년도 시간당 최저임금은 ${CORRECT_WON.toLocaleString()}원으로 결정됐습니다.`,
    sources: [MIN_WAGE_2027_SOURCE],
  }];
}

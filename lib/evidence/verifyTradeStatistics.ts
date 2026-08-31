import { EvidenceIssue } from "../types";

const JULY_2026_SOURCE = {
  title: "관세청 「2026년 7월 기업규모별 수출입 현황」",
  url: "https://m.korea.kr/briefing/pressReleaseView.do?gubun=pressRelease&newsId=156775588&pageIndex=1&repCode=nts",
};

// 관세청 발표의 구조화된 핵심 수치. 숫자를 문장 유사도가 아닌 항목·단위·기준시점으로 비교한다.
export function verifyJuly2026TradeStatistics(claimText: string, documentText: string): EvidenceIssue[] {
  const context = `${documentText}\n${claimText}`;
  if (!/2026년\s*7월/.test(context) || !/기업규모별\s*수출입/.test(context) || !/관세청/.test(context)) return [];

  const compact = claimText.replace(/,/g, "").replace(/\s+/g, " ");
  const issues: EvidenceIssue[] = [];

  if (/전체\s*수출액/.test(compact)) {
    const amount = compact.match(/전체\s*수출액(?:은|이)?\s*([\d.]+)\s*억\s*달러/)?.[1];
    const rate = compact.match(/(?:전년\s*동월|지난해\s*같은\s*달)(?:\s*대비|보다)?\s*([\d.]+)\s*%\s*증가/)?.[1];
    if (amount && Number(amount) !== 990) issues.push(issue(`${Number(amount).toLocaleString()}억 달러`, "관세청 발표의 2026년 7월 전체 수출액은 990억 달러입니다."));
    if (rate && Number(rate) !== 63) issues.push(issue(`${rate}% 증가`, "관세청 발표의 전년 동월 대비 전체 수출 증가율은 63.0%입니다."));
  }

  if (/대기업\s*수출/.test(compact)) {
    const amount = compact.match(/대기업\s*수출(?:액)?(?:은|이)?\s*([\d.]+)\s*억\s*달러/)?.[1];
    const rate = compact.match(/대기업\s*수출[^.%]{0,45}?([\d.]+)\s*%\s*증가/)?.[1]
      ?? compact.match(/전년\s*동월\s*대비\s*([\d.]+)\s*%\s*증가/)?.[1];
    if (amount && Number(amount) !== 744) issues.push(issue(`${Number(amount).toLocaleString()}억 달러`, "관세청 발표의 대기업 수출액은 744억 달러입니다."));
    if (rate && Number(rate) !== 90.7) issues.push(issue(`${rate}% 증가`, "관세청 발표의 대기업 수출 증가율은 90.7%입니다."));
  }

  return issues;
}

function issue(phrase: string, reason: string): EvidenceIssue {
  return { phrase, reason, sources: [JULY_2026_SOURCE] };
}

import { EvidenceIssue } from "../types";

const ALBA_SURVEY_SOURCE = { title: "알바천국 「2027년도 최저임금 만족도 설문조사」", url: "https://www.alba.co.kr/" };
const CORRECT_RATE = { 알바생: 52.6, 사장님: 55.1 };

// 이 설문(알바생 1,039명·사장님 225명, 이달 6~10일 조사)은 민간기업 알바천국이 발표한
// 것인데, "고용노동부가 발표했다"는 출처 오도와 불만족률 부풀리기가 실측에서 AI 판정에
// 걸리지 않아(웹검색이 이 민간 설문 자체를 찾지 못해 항상 insufficient로 빠짐),
// verifyMinimumWage.ts와 같은 방식으로 결정론적으로 대조한다.
export function verifyAlbaSurvey(claimText: string, documentText: string): EvidenceIssue[] {
  const context = `${documentText}\n${claimText}`;
  if (!/1[,]?039\s*명/.test(context) || !/225\s*명/.test(context)) return [];

  const issues: EvidenceIssue[] = [];

  if (/고용노동부/.test(claimText) && /(설문조사|응답)/.test(claimText)) {
    issues.push({
      phrase: "고용노동부",
      reason: "이 설문조사는 정부기관이 아니라 민간기업 알바천국이 발표한 조사입니다.",
      sources: [ALBA_SURVEY_SOURCE],
    });
  }

  const albaRate = claimText.match(/알바생[^.]{0,10}?(\d+(?:\.\d+)?)\s*%/)?.[1];
  if (albaRate && Number(albaRate) !== CORRECT_RATE.알바생) {
    issues.push({
      phrase: `${albaRate}%`,
      reason: `실제 알바천국 조사에서 알바생 불만족률은 ${CORRECT_RATE.알바생}%입니다.`,
      sources: [ALBA_SURVEY_SOURCE],
    });
  }

  const bossRate = claimText.match(/사장님[^.]{0,10}?(\d+(?:\.\d+)?)\s*%/)?.[1];
  if (bossRate && Number(bossRate) !== CORRECT_RATE.사장님) {
    issues.push({
      phrase: `${bossRate}%`,
      reason: `실제 알바천국 조사에서 사장님 불만족률은 ${CORRECT_RATE.사장님}%입니다.`,
      sources: [ALBA_SURVEY_SOURCE],
    });
  }

  return issues;
}

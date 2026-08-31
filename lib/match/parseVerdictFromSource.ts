import { OfficialItem, Verdict } from "../types";

// AI가 새로 진위를 판정하지 않는다는 핵심 설계 원칙에 따라, 매칭된 공식 항목의 결론은
// LLM이 아니라 원문 텍스트에 이미 적힌 표현을 규칙 기반으로 추출해 그대로 보여준다.
// 부정 표현이 섞인 문장(예: "허위가 아니라...")까지 잘못 잡지 않도록,
// 결론을 명확히 단정하는 구체적인 어구만 패턴으로 사용한다(단어 하나만으로는 판단하지 않음).
const CONFLICT_PATTERNS = [
  /사실이?\s*아닙니다/,
  /사실무근입니다/,
  /사칭\s*(사기|광고|영상)/,
  /허위\s*(사실|정보|주장|광고)(?!.{0,6}아니)/,
  /낭설입니다/,
];
const SUPPORTED_PATTERNS = [/사실입니다/, /사실로\s*확인/, /사실에?\s*부합합니다/];

export function parseVerdict(item: OfficialItem): { verdict: Verdict; excerpt: string } {
  const text = `${item.title} ${item.body}`;

  const conflictMatch = findMatch(text, CONFLICT_PATTERNS);
  if (conflictMatch) {
    return { verdict: "conflict", excerpt: conflictMatch };
  }

  const supportedMatch = findMatch(text, SUPPORTED_PATTERNS);
  if (supportedMatch) {
    return { verdict: "supported", excerpt: supportedMatch };
  }

  // '사실확인' 코너 항목인데 명시적 패턴이 없으면, 해당 코너 자체가 반박 목적이므로 상충으로 간주.
  return { verdict: "conflict", excerpt: item.title };
}

function findMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const idx = text.search(pattern);
    if (idx === -1) continue;
    const sentences = text.split(/(?<=[.!?。？！])\s+/);
    const hit = sentences.find((s) => pattern.test(s));
    return hit?.trim() ?? text.slice(Math.max(0, idx - 20), idx + 40).trim();
  }
  return null;
}

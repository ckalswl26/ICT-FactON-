import { Claim, OfficialItem } from "../types";

// 주장이 기존 '사실확인' 공식반박 항목과 같은 소재를 다루는지만 판별한다(진위 판정 아님).
// 매칭되면 그 항목이 이미 내놓은 결론을 다음 단계(parseVerdictFromSource)에서 그대로 추출해 보여줄 뿐,
// 여기서는 "같은 이야기를 다루고 있는가"라는 존재 매칭만 수행한다.
export async function matchClaim(
  claim: Claim,
  candidates: OfficialItem[]
): Promise<OfficialItem | null> {
  if (candidates.length === 0) return null;
  return matchClaimFallback(claim, candidates);
}

// Claude 키가 없을 때를 위한 단순 키워드 겹침 폴백 매칭.
// "matched"로 뜨면 화면에 고신뢰(🔴/🟢)로 표시되므로 오탐 비용이 매우 크다 — 실측 결과
// "모두/있는/것으로/나타났다"처럼 아무 기사에나 나오는 기능어만 겹쳐도 비율 임계값(0.3)을
// 넘겨 전혀 무관한 정부 문서와 매칭되는 버그가 있었다(예: "역대 최고 인상폭에도... 반발"
// 문장이 국민성장펀드 관련 문서와 0.333으로 매칭). tokenize()에서 이런 기능어를 아예
// 제외하고, 비율과 별개로 절대 개수 하한도 둔다.
const FUNCTION_WORD_STOPLIST = new Set([
  "모두", "있는", "있다", "없는", "없다", "것으로", "것이다", "나타났다", "밝혔다", "전했다",
  "말했다", "덧붙였다", "설명했다", "이번", "오늘", "최근", "지난", "한편", "또한", "그러나",
  "하지만", "그리고", "위해", "대해", "통해", "관련", "대한", "따르면", "따라", "가운데",
  "동안", "당시", "현재", "이후", "이전", "그동안", "앞으로", "다시", "매우", "정말", "너무",
]);
const MIN_OVERLAP_RATIO = 0.3;
const MIN_OVERLAP_COUNT = 2;

function matchClaimFallback(claim: Claim, candidates: OfficialItem[]): OfficialItem | null {
  const claimTokens = tokenize(claim.text);
  if (claimTokens.size === 0) return null;

  let best: { item: OfficialItem; score: number; overlap: number } | null = null;
  for (const item of candidates) {
    const itemTokens = tokenize(`${item.title} ${item.body}`);
    const overlap = [...claimTokens].filter((t) => itemTokens.has(t)).length;
    const score = overlap / claimTokens.size;
    if (!best || score > best.score) best = { item, score, overlap };
  }

  if (!best || best.score < MIN_OVERLAP_RATIO || best.overlap < MIN_OVERLAP_COUNT) return null;
  return best.item;
}

// 조사(을/를/이/가/에 등)가 붙은 채로 비교하면 같은 단어도 다른 토큰으로 취급돼 겹침 점수가
// 실제보다 낮게 나온다(lib/evidence/searchPublicWeb.ts의 동일 버그와 같은 원인). 끝에서만 제거한다.
// "가"·"의"는 "물가"/"평가"/"회의"처럼 단어 끝음절로 흔히 쓰여 오히려 핵심어를 깨뜨리므로 뺐다.
const MULTI_CHAR_PARTICLES = /(?:에게|에서|으로|이라고|라고|다고|든지|까지|부터|이나|하고|이며|보다|처럼|만큼|한테|께서|이라는|라는|이라며)$/;
const SINGLE_CHAR_PARTICLES = /(?:은|는|이|을|를|에|도|만|와|과|로)$/;

function stripParticles(word: string): string {
  let result = word;
  if (result.length > 4 && MULTI_CHAR_PARTICLES.test(result)) {
    result = result.replace(MULTI_CHAR_PARTICLES, "");
  }
  if (result.length > 3 && SINGLE_CHAR_PARTICLES.test(result)) {
    result = result.replace(SINGLE_CHAR_PARTICLES, "");
  }
  return result;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .map(stripParticles)
      .filter((t) => t.length >= 2 && !FUNCTION_WORD_STOPLIST.has(t))
  );
}

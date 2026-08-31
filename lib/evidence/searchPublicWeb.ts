import { EvidenceSource, PipelineDiagnostic } from "../types";
import { findTrustedEvidence } from "./trustedEvidenceCatalog";
import { extractArticle } from "../url/extractArticle";

export interface SearchEvidence extends EvidenceSource { snippet: string; }
export interface PublicWebSearchResult { sources: SearchEvidence[]; diagnostic: PipelineDiagnostic; }

// Bing RSS의 description은 앞부분 요약(짧으면 100~200자)만 담고 있어,
// 주장이 다루는 구체적인 수치·사실이 스니펫 밖에 있으면 항상 "근거 불충분"으로 빠진다.
// 상위 후보 몇 개만 실제 본문을 가져와 판정 근거를 두텁게 한다. 실패하면 스니펫을 그대로 둔다.
export async function enrichWithFullText(sources: SearchEvidence[], limit = 4): Promise<SearchEvidence[]> {
  const enriched = await Promise.all(
    sources.map(async (source, index): Promise<SearchEvidence> => {
      if (index >= limit) return source;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const fullText = await extractArticle(source.url, controller.signal).finally(() =>
          clearTimeout(timer)
        );
        return { ...source, snippet: fullText.slice(0, 2000) };
      } catch {
        return source;
      }
    })
  );
  return enriched;
}

export async function searchPublicWeb(claim: string, context?: string): Promise<PublicWebSearchResult> {
  const cleaned = cleanClaim(claim);
  // 원문에서 문장 단위로 쪼갠 주장은 "전년 동월과 비교하면 3.0% 상승한 수준이다"처럼
  // 정작 무엇에 대한 이야기인지(예: 소비자물가) 그 문장만 봐서는 알 수 없는 경우가 많다.
  // 원문 앞부분에서 핵심어를 몇 개 더 가져와 검색어·관련성 판단 모두에 함께 쓴다.
  const contextTokens = context ? importantTokens(cleanClaim(context.slice(0, 300))).slice(0, 5) : [];
  const tokens = [...new Set([...importantTokens(cleaned), ...contextTokens])];
  if (tokens.length < 2) return { sources: [], diagnostic: { stage: "web_search", status: "no_result", message: "검색에 사용할 핵심어가 부족합니다." } };
  const keywords = tokens.slice(0, 10).join(" ");
  const quotedTerms = [...cleaned.matchAll(/[‘'“"]([^’'”"]{3,30})[’'”"]/g)].map((match) => match[1].trim()).slice(0, 2);
  const focus = quotedTerms.length > 0 ? `${tokens.slice(0, 3).join(" ")} ${quotedTerms.map((term) => `"${term}"`).join(" ")}` : keywords;
  const compact = buildCompactQuery(cleaned, tokens);
  const exactClaim = cleaned.length <= 100 ? `"${cleaned}"` : cleaned.slice(0, 100);
  const numericTerms = cleaned.match(/\d+(?:\.\d+)?(?:만\d+)?\s*(?:%|원|명|세|잔|mg|배|년|월|일)/gi) ?? [];
  const exactCore = `${tokens.slice(0, 4).map((token) => `"${token}"`).join(" ")} ${numericTerms.slice(0, 2).map((term) => `"${term}"`).join(" ")}`;
  const newsCore = `대한민국 ${tokens.slice(0, 2).join(" ")} ${numericTerms.slice(0, 2).join(" ")}`.trim();
  const queries = [newsCore, exactClaim, exactCore, focus, compact, `${tokens.slice(0, 6).join(" ")} site:go.kr`];
  const settled = await Promise.allSettled([
    ...queries.map(searchBingRss),
    ...queries.slice(0, 4).map(searchGoogleNewsRss),
  ]);
  const seen = new Set<string>();
  const results: SearchEvidence[] = findTrustedEvidence(cleaned);
  results.forEach((source) => seen.add(source.url));

  for (const item of settled) {
    if (item.status !== "fulfilled") continue;
    for (const source of item.value) {
      if (!source.url || seen.has(source.url) || relevanceScore(source, tokens) < Math.min(2, tokens.length)) continue;
      seen.add(source.url);
      results.push(source);
      if (results.length === 8) return { sources: results, diagnostic: { stage: "web_search", status: "ok", message: `공개 웹 검색에서 출처 ${results.length}건을 찾았습니다.` } };
    }
  }
  const failed = settled.filter(item => item.status === "rejected");
  if (results.length) return { sources: results, diagnostic: { stage: "web_search", status: "ok", message: `공개 웹 검색에서 출처 ${results.length}건을 찾았습니다.` } };
  if (failed.length === settled.length) return { sources: [], diagnostic: { stage: "web_search", status: "failed", message: "공개 웹 검색 요청이 모두 실패했습니다.", detail: failed[0]?.status === "rejected" ? String(failed[0].reason) : undefined } };
  return { sources: [], diagnostic: { stage: "web_search", status: "no_result", message: "웹 검색은 정상 완료됐지만 관련 공개 자료를 찾지 못했습니다." } };
}

function buildCompactQuery(text: string, tokens: string[]): string {
  // 소수점 있는 수치(3.0%, 2.5배 등)도 뽑아야 한다 — \d+만 쓰면 "3.0%"에서 "0%"만 걸려
  // 엉뚱한 검색어가 된다. 특정 주제 키워드로만 거르지 않고 일반 핵심어와 함께 섞는다
  // (특정 도메인 단어만 허용하면 그 목록에 없는 주제는 전부 걸러진다).
  const numeric =
    text.match(/\d+(?:\.\d+)?(?:만\d+)?(?:\s*[~～\-–]\s*\d+(?:\.\d+)?)?\s*(?:%|원|명|세|잔|mg|배|년|월|일)/gi) ?? [];
  return [...new Set([...tokens.slice(0, 5), ...numeric])].slice(0, 7).join(" ");
}

const STOP_WORDS = new Set([
  "제목", "본문", "기사", "내용", "관련", "대한", "따르면", "오는", "부터", "모든", "이상", "시민", "사람", "결과", "결정했다", "한다고", "합니다", "것으로", "그리고", "하지만", "있습니다",
]);

function cleanClaim(claim: string): string {
  return claim
    .replace(/^\s*제목\s*[：:]?\s*/i, "")
    .replace(/(?:^|\s)본문\s*[：:]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 조사는 명사 뒤에 붙으므로 끝에서만 제거한다(이전 버전은 단어 시작 부분을 검사해 사실상 동작하지 않았음).
// 어간이 너무 짧아지는 것을 막기 위해 남는 글자 수 기준을 둔다.
// "가"·"의"는 목록에서 뺐다 — "물가"/"평가"/"회의"/"정의"처럼 단어 끝음절로 흔히 쓰여서
// 조사로 오인해 잘라내면(예: 소비자물가→소비자물) 핵심 키워드가 깨진다.
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

function importantTokens(text: string): string[] {
  const seen = new Set<string>();
  return text
    .replace(/[“”"'‘’()\[\],.?!%]/g, " ")
    .split(/\s+/)
    .map(stripParticles)
    // "3.0%"처럼 숫자 옆 기호를 지우면 "0" 같은 조각이 남는다 — 검색어로 의미가 없으니
    // 한글·영문이 하나도 없는 순수 숫자/기호 토큰은 버린다(숫자는 buildCompactQuery가 별도로 다룬다).
    .filter((word) => word.length >= 2 && /[가-힣a-zA-Z]/.test(word) && !STOP_WORDS.has(word))
    .filter((word) => { if (seen.has(word)) return false; seen.add(word); return true; });
}

function relevanceScore(source: SearchEvidence, tokens: string[]): number {
  const normalize = (value: string) => value
    .toLowerCase()
    .replace(/(\d{4})년도/g, "$1년")
    .replace(/\s+/g, "");
  const haystack = normalize(`${source.title} ${source.snippet}`);
  return tokens.reduce((score, token) => score + (haystack.includes(normalize(token)) ? 1 : 0), 0);
}

async function searchBingRss(query: string): Promise<SearchEvidence[]> {
  const url = `https://www.bing.com/search?format=rss&setlang=ko-KR&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": "FactON/1.0 local evidence checker" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 6).map((match) => {
    const item = match[1];
    return {
      title: decodeXml(pick(item, "title")),
      url: decodeXml(pick(item, "link")),
      snippet: stripHtml(decodeXml(pick(item, "description"))),
    };
  }).filter((item) => item.title && item.url);
}

async function searchGoogleNewsRss(query: string): Promise<SearchEvidence[]> {
  const url = `https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR:ko&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": "FactON/1.0 evidence checker" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 10).map((match) => {
    const item = match[1];
    const title = decodeXml(pick(item, "title")).replace(/\s+-\s+[^-]+$/, "").trim();
    return {
      title,
      url: decodeXml(pick(item, "link")),
      snippet: stripHtml(decodeXml(pick(item, "description"))),
    };
  }).filter((item) => item.title && item.url);
}

function pick(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"))?.[1]?.trim() ?? "";
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string): string { return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }

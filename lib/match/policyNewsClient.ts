import { OfficialItem, PipelineDiagnostic } from "../types";

const ENDPOINT = "https://apis.data.go.kr/1371000/policyNewsService2/policyNewsList2";
// The policy API rejects ranges longer than three days
// (result code 98: THREE_DAYS_OVER_ERROR).
const CHUNK_DAYS = 3;
// 900일치는 3일 단위로 쪼개면 요청 300개가 되는데, data.go.kr 키의 일일 쿼터가 1000건뿐이라
// 캐시가 비어 다시 채울 때마다(서버 재시작, 24시간 TTL 만료 등) 하루 쿼터의 30%를 한 번에
// 태우고 속도제한(HTTP 429)까지 걸려 매번 자료가 부분적으로만 채워졌다. 180일(60요청)로
// 줄이면 쿼터 여유가 훨씬 커지고 완전히 받아오는 데 걸리는 시간도 짧아진다. 더 오래된
// '사실은 이렇습니다' 항목까지 매칭하고 싶다면 늘려도 되지만, 그만큼 쿼터/속도제한 위험도 커진다.
export const WINDOW_DAYS = 180;
const CONCURRENCY = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;
let cache: { items: OfficialItem[]; fetchedAt: number; diagnostic: PipelineDiagnostic } | null = null;
let pendingFetch: Promise<PolicySearchResult> | null = null;

export interface PolicySearchResult { items: OfficialItem[]; diagnostic: PipelineDiagnostic; elapsedMs: number; requests: number; }

async function fetchRecentItems(): Promise<PolicySearchResult> {
  const started = Date.now();
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return { items: cache.items, diagnostic: cache.diagnostic, elapsedMs: Date.now() - started, requests: 0 };
  if (pendingFetch) return pendingFetch;

  pendingFetch = fetchRecentItemsUncached();
  try {
    return await pendingFetch;
  } finally {
    pendingFetch = null;
  }
}

async function fetchRecentItemsUncached(): Promise<PolicySearchResult> {
  const started = Date.now();
  const apiKey = process.env.POLICY_NEWS_API_KEY;
  if (!apiKey) return { items: [], diagnostic: { stage: "policy_api", status: "unavailable", message: "정책뉴스 API 키가 설정되지 않았습니다." }, elapsedMs: 0, requests: 0 };
  const chunks = buildDateChunks(WINDOW_DAYS, CHUNK_DAYS);
  const items: OfficialItem[] = []; const errors: string[] = [];
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = await Promise.allSettled(chunks.slice(i, i + CONCURRENCY).map(({ start, end }) => fetchChunk(apiKey, start, end)));
    for (const result of batch) result.status === "fulfilled" ? items.push(...result.value) : errors.push(errorMessage(result.reason));
  }
  const unique = [...new Map(items.map(item => [item.id || item.url, item])).values()];
  const diagnostic: PipelineDiagnostic = errors.length === chunks.length
    ? { stage: "policy_api", status: "failed", message: "정책뉴스 API의 900일 자료 조회에 실패했습니다.", detail: errors[0] }
    : errors.length ? { stage: "policy_api", status: "failed", message: `정책뉴스 일부 기간 조회에 실패했습니다. (${chunks.length - errors.length}/${chunks.length}구간 성공)`, detail: errors[0] }
    : { stage: "policy_api", status: "ok", message: `최근 ${WINDOW_DAYS}일 정책자료 ${unique.length}건을 조회했습니다.` };
  cache = { items: unique, fetchedAt: Date.now(), diagnostic };
  return { items: unique, diagnostic, elapsedMs: Date.now() - started, requests: chunks.length };
}

async function fetchChunk(apiKey: string, startDate: string, endDate: string, attempt = 0): Promise<OfficialItem[]> {
  const params = new URLSearchParams({ serviceKey: safeDecode(apiKey), numOfRows: "100", pageNo: "1", startDate, endDate });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(6000) });
  if (res.status === 429 && attempt < MAX_RETRIES) {
    await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    return fetchChunk(apiKey, startDate, endDate, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text(); const code = pickTag(xml, "resultCode");
  if (code && code !== "0") throw new Error(`${code}: ${pickTag(xml, "resultMsg")}`);
  return [...xml.matchAll(/<NewsItem>([\s\S]*?)<\/NewsItem>/g)].map(match => parseNewsItem(match[1]));
}

function parseNewsItem(xml: string): OfficialItem { const date = pickTag(xml, "ApproveDate").match(/(\d{2})\/(\d{2})\/(\d{4})/); return { id: pickTag(xml,"NewsItemId"), contentType: pickTag(xml,"GroupingCode") === "fact" ? "사실확인" : "정책뉴스", title: stripHtml(decodeEntities(pickTag(xml,"Title"))), body: stripHtml(decodeEntities(pickTag(xml,"DataContents"))), agency: pickTag(xml,"MinisterCode"), date: date ? `${date[3]}-${date[1]}-${date[2]}` : "", url: decodeEntities(pickTag(xml,"OriginalUrl")) }; }
function buildDateChunks(windowDays:number, chunkDays:number){ const chunks:{start:string;end:string}[]=[]; const today=new Date(); for(let offset=0;offset<windowDays;offset+=chunkDays){const end=new Date(today);end.setDate(end.getDate()-offset);const start=new Date(end);start.setDate(start.getDate()-Math.min(chunkDays,windowDays-offset)+1);chunks.push({start:dateKey(start),end:dateKey(end)});}return chunks; }
function dateKey(date:Date){return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;}
function safeDecode(value:string){try{return decodeURIComponent(value);}catch{return value;}}
function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
function pickTag(xml:string,tag:string){return xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,"i"))?.[1]?.trim()??"";}
function decodeEntities(value:string){return value.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&nbsp;/g," ").replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,code)=>String.fromCharCode(Number(code)));}
function stripHtml(value:string){return value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function errorMessage(error:unknown){return error instanceof Error?error.message:String(error);}

export async function searchFactCheck(_query:string):Promise<PolicySearchResult>{const result=await fetchRecentItems();return {...result,items:result.items.filter(item=>item.contentType==="사실확인")};}
export async function searchAll(_query:string):Promise<PolicySearchResult>{return fetchRecentItems();}

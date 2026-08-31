import { Claim, ClaimResult, EvidenceAssessment, EvidenceResult, PipelineDiagnostic } from "../types";
import { searchPublicWeb, enrichWithFullText } from "./searchPublicWeb";
import { verifyContextualPlaces } from "./verifyKoreanPlaces";
import { verifyHighDoseCoffeeAdvice } from "./trustedEvidenceCatalog";
import { verifyJuly2026TradeStatistics } from "./verifyTradeStatistics";
import { verifyWithClaudeSearch } from "./verifyWithClaudeSearch";
import { verifyWithGeminiSearch } from "./verifyWithGeminiSearch";
import { verifyWithGemmaEvidence } from "./verifyWithGemmaEvidence";

interface Payload { assessment?: EvidenceAssessment; summary?: string; problematicPart?: string; correction?: string; sourceIndexes?: number[]; }
export interface VerificationOutcome { result: ClaimResult; diagnostics: PipelineDiagnostic[]; }
const OLLAMA_URL=process.env.OLLAMA_BASE_URL||"http://127.0.0.1:11434"; const OLLAMA_MODEL=process.env.OLLAMA_MODEL||"qwen3:8b";

export async function verifyClaim(claim:Claim,documentText=claim.text):Promise<VerificationOutcome>{
  const local=verifyContextualPlaces(claim.text,documentText); if(local.length)return{result:conflict(claim,"문서에 등장한 행정구역 또는 기관 명칭이 공식 목록과 일치하지 않습니다.",local.flatMap(i=>i.sources)),diagnostics:[]};
  const health=verifyHighDoseCoffeeAdvice(claim.text); if(health.length)return{result:conflict(claim,"건강·안전 권고와 일치하지 않는 표현이 확인됐습니다.",health.flatMap(i=>i.sources)),diagnostics:[]};
  const trade=verifyJuly2026TradeStatistics(claim.text,documentText); if(trade.length)return{result:conflict(claim,"공식 무역 통계의 수치와 일치하지 않습니다.",trade.flatMap(i=>i.sources)),diagnostics:[]};

  const claude=await verifyWithClaudeSearch(claim,documentText); if(claude.result)return{result:claude.result,diagnostics:[claude.diagnostic]};
  const usesGemma=(process.env.GEMINI_MODEL||"").startsWith("gemma-");
  const gemini=usesGemma?undefined:await verifyWithGeminiSearch(claim,documentText); if(gemini?.result)return{result:gemini.result,diagnostics:[claude.diagnostic,gemini.diagnostic]};
  const aiDiagnostics=gemini?[claude.diagnostic,gemini.diagnostic]:[claude.diagnostic];
  const web=await searchPublicWeb(claim.text,documentText);
  if(!web.sources.length){
    if(web.diagnostic.status==="failed") return{result:{status:"error",claim,stage:"web_search",title:"웹 검색 연결 오류",message:web.diagnostic.message,retryable:true},diagnostics:[...aiDiagnostics,web.diagnostic]};
    return{result:{status:"evidence",claim,assessment:"insufficient",summary:"검색은 정상 완료됐지만 이 주장을 직접 입증하거나 반박할 공개 자료를 찾지 못했습니다.",sources:[]},diagnostics:[...aiDiagnostics,web.diagnostic]};
  }
  const evidence=await enrichWithFullText(web.sources); const sourceText=evidence.map((item,index)=>`[${index+1}] ${item.title}\n${item.snippet}\n${item.url}`).join("\n\n");
  if(usesGemma){const gemma=await verifyWithGemmaEvidence(claim,evidence);if(gemma.result)return{result:gemma.result,diagnostics:[...aiDiagnostics,web.diagnostic,gemma.diagnostic]};aiDiagnostics.push(gemma.diagnostic);}
  try{
    // 로컬 8B 모델로 검색결과 여러 건을 비교·판정하는 호출이라 10초로는 자주 타임아웃됐다.
    const response=await fetch(`${OLLAMA_URL}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(30000),body:JSON.stringify({model:OLLAMA_MODEL,stream:false,format:"json",options:{temperature:.1,num_ctx:8192},messages:[{role:"system",content:"당신은 한국어 근거 검증 보조 도구입니다. 제공된 검색 자료만 사용하세요. 자료가 주장을 직접 뒷받침하지 않으면 insufficient로 판정하고, 선택한 sourceIndexes에 실제 사용한 자료 번호만 넣으세요. JSON만 출력하세요."},{role:"user",content:`주장: ${claim.text}\n\n검색 자료:\n${sourceText}\n\n형식: {"assessment":"supported|conflict|insufficient","summary":"비교 결과","problematicPart":"문제 표현 또는 빈 문자열","correction":"교정 문장 또는 빈 문자열","sourceIndexes":[1,2]}`} ]})});
    if(!response.ok)throw new Error(`Ollama HTTP ${response.status}`); const data=await response.json() as{message?:{content?:string}}; const payload=parse(data.message?.content||""); const selected=(payload.sourceIndexes||[]).filter(i=>Number.isInteger(i)&&i>0&&i<=evidence.length).map(i=>evidence[i-1]);
    if(!selected.length)return{result:{status:"evidence",claim,assessment:"insufficient",summary:"직접 판정할 근거는 부족하지만, 관련 공개 웹 자료를 찾아 확인할 수 있습니다.",sources:evidence.slice(0,6).map(({title,url})=>({title,url}))},diagnostics:[...aiDiagnostics,web.diagnostic,{stage:"local_ai",status:"no_result",message:"로컬 AI가 직접 근거를 선택하지 않아 관련 검색 출처를 대신 표시합니다."}]};
    const assessment=payload.assessment==="supported"||payload.assessment==="conflict"?payload.assessment:"insufficient"; return{result:{status:"evidence",claim,assessment,summary:payload.summary||"검색 자료와 주장을 비교했습니다.",problematicPart:assessment==="insufficient"?undefined:payload.problematicPart||undefined,correction:assessment==="insufficient"?undefined:payload.correction||undefined,sources:selected.map(({title,url})=>({title,url}))},diagnostics:[...aiDiagnostics,web.diagnostic,{stage:"local_ai",status:"ok",message:"로컬 AI가 검색 근거를 비교했습니다."}]};
  }catch(error){return{result:{status:"evidence",claim,assessment:"insufficient",summary:"AI 최종 판정은 완료되지 않았지만, 관련 공개 웹 자료를 찾아 확인할 수 있습니다.",sources:evidence.slice(0,6).map(({title,url})=>({title,url}))},diagnostics:[...aiDiagnostics,web.diagnostic,{stage:"local_ai",status:"failed",message:"로컬 AI 판정은 실패했지만 검색 출처는 정상적으로 표시합니다.",detail:errorMessage(error)}]};}
}
function conflict(claim:Claim,summary:string,sources:{title:string;url:string}[]):EvidenceResult{return{status:"evidence",claim,assessment:"conflict",summary,sources:[...new Map(sources.map(s=>[s.url,s])).values()]};}
function parse(raw:string):Payload{const match=raw.match(/\{[\s\S]*\}/);if(!match)return{};try{return JSON.parse(match[0]) as Payload;}catch{return{};}}
function errorMessage(error:unknown){return error instanceof Error?error.message:String(error);}

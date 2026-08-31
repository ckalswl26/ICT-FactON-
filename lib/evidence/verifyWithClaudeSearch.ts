import type Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL, getAnthropicClient } from "../anthropic";
import { Claim, EvidenceAssessment, EvidenceResult, EvidenceSource, PipelineDiagnostic } from "../types";

const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 5 } as const;
interface Payload { assessment?: EvidenceAssessment; summary?: string; problematicPart?: string; correction?: string; }
export interface ClaudeVerificationAttempt { result?: EvidenceResult; diagnostic: PipelineDiagnostic; }

export async function verifyWithClaudeSearch(claim: Claim, documentText: string): Promise<ClaudeVerificationAttempt> {
  const client = getAnthropicClient();
  if (!client) return { diagnostic: { stage: "claude_search", status: "unavailable", message: "Claude API 키가 없어 AI 웹 검색을 실행하지 못했습니다." } };
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `다음 한국어 주장을 웹 검색으로 검증하세요. 정부·공공기관·원문·공식 통계를 우선 검색하고 기사 제목만으로 판단하지 마세요. 시점, 조사 대상, 단위와 수치를 각각 비교하세요. 직접적인 근거가 부족하면 insufficient로 판정하세요. 마지막에는 반드시 JSON 객체만 출력하세요.\n\n문서 맥락:\n${documentText.slice(0,5000)}\n\n검증할 주장:\n${claim.text}\n\n형식: {"assessment":"supported|conflict|insufficient","summary":"근거 비교 결과","problematicPart":"틀리거나 과장된 구체적 표현 또는 빈 문자열","correction":"근거에 맞춘 문장 또는 빈 문자열"}` }];
  try {
    let response = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 2048, tools: [WEB_SEARCH_TOOL], messages });
    for (let turn=0;turn<3&&response.stop_reason==="pause_turn";turn++){messages.push({role:"assistant",content:response.content});response=await client.messages.create({model:CLAUDE_MODEL,max_tokens:2048,tools:[WEB_SEARCH_TOOL],messages});}
    const sources=extractSources(response.content); const blocks=response.content.filter(block=>block.type==="text"); const last=blocks.at(-1); const payload=last?.type==="text"?parsePayload(last.text):{}; const assessment=normalizeAssessment(payload.assessment);
    if(assessment==="insufficient") return { diagnostic:{stage:"claude_search",status:"no_result",message:"Claude 검색은 정상 완료됐지만 직접적인 근거가 충분하지 않았습니다."} };
    if(!sources.length) return { diagnostic:{stage:"claude_search",status:"failed",message:"Claude가 판정을 반환했지만 인용 가능한 검색 출처가 없었습니다."} };
    return { result:{status:"evidence",claim,assessment,summary:payload.summary?.trim()||"검색 근거와 주장을 비교했습니다.",problematicPart:payload.problematicPart?.trim()||undefined,correction:payload.correction?.trim()||undefined,sources}, diagnostic:{stage:"claude_search",status:"ok",message:`Claude 웹 검색에서 출처 ${sources.length}건을 확인했습니다.`} };
  } catch(error){ return { diagnostic:{stage:"claude_search",status:"failed",message:"Claude 웹 검색 호출에 실패했습니다.",detail:errorMessage(error)} }; }
}
function extractSources(content:Anthropic.ContentBlock[]):EvidenceSource[]{const sources:EvidenceSource[]=[];for(const block of content){if(block.type!=="web_search_tool_result"||!Array.isArray(block.content))continue;for(const item of block.content)sources.push({title:item.title,url:item.url});}return [...new Map(sources.map(source=>[source.url,source])).values()].slice(0,8);}
function parsePayload(raw:string):Payload{const match=raw.match(/\{[\s\S]*\}/);if(!match)return{};try{return JSON.parse(match[0]) as Payload;}catch{return{};}}
function normalizeAssessment(value?:string):EvidenceAssessment{return value==="supported"||value==="conflict"?value:"insufficient";}
function errorMessage(error:unknown){return error instanceof Error?error.message:String(error);}

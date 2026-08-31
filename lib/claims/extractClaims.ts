import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, CLAUDE_MODEL } from "../anthropic";
import { Claim, PipelineDiagnostic } from "../types";

export interface ClaimExtractionResult { claims: Claim[]; diagnostic: PipelineDiagnostic; }

export async function extractClaims(text: string): Promise<ClaimExtractionResult> {
  const client = getAnthropicClient();
  if (!client) return { claims: extractClaimsHeuristic(text), diagnostic: { stage: "claim_extraction", status: "unavailable", message: "AI GMS API 키가 없어 규칙 기반으로 주장을 추출했습니다." } };
  try {
    const claims = await extractClaimsWithClaude(client, text);
    return { claims, diagnostic: { stage: "claim_extraction", status: "ok", message: "AI GMS가 검증 가능한 주장을 추출했습니다." } };
  } catch (error) {
    return { claims: extractClaimsHeuristic(text), diagnostic: { stage: "claim_extraction", status: "failed", message: "AI GMS 주장 추출에 실패해 규칙 기반 분석으로 전환했습니다.", detail: errorMessage(error) } };
  }
}

async function extractClaimsWithClaude(client: Anthropic, text: string): Promise<Claim[]> {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: "당신은 한국어 팩트체크 서비스의 주장 추출기입니다. 입력문에서 외부 자료로 검증 가능한 사실 주장을 1~5개 추출하세요. 수치, 날짜, 정책, 조사 결과처럼 확인 가능한 문장을 우선합니다. 진위를 판단하지 말고 JSON 배열만 출력하세요. 형식: [{\"text\":\"주장 내용\"}]",
    messages: [{ role: "user", content: text }],
  });
  const block = response.content.find(item => item.type === "text");
  if (!block || block.type !== "text") throw new Error("AI GMS 응답에 텍스트가 없습니다.");
  const match = block.text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("AI GMS 응답에서 JSON 배열을 찾지 못했습니다.");
  const parsed = JSON.parse(match[0]) as { text?: string }[];
  const claims = parsed.filter(item => item.text?.trim()).slice(0, 5).map((item, index) => ({ id: `claim-${index + 1}`, text: item.text!.trim() }));
  if (!claims.length) throw new Error("추출된 주장이 없습니다.");
  return claims;
}

function extractClaimsHeuristic(text: string): Claim[] {
  const sentences = text.replace(/^\s*제목\s*[:：]?\s*/i, "").replace(/(?:^|\s)본문\s*[:：]?\s*/gi, ". ").replace(/\s+/g, " ").split(/(?<=[.!?。！？])\s+|\n+/).map(value => value.trim()).filter(value => value.length >= 10);
  return (sentences.length ? sentences : [text.trim()]).slice(0, 5).map((value, index) => ({ id: `claim-${index + 1}`, text: value }));
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }

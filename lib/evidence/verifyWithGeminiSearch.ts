import { Claim, EvidenceAssessment, EvidenceResult, EvidenceSource, PipelineDiagnostic } from "../types";

interface Payload { assessment?: EvidenceAssessment; summary?: string; problematicPart?: string; correction?: string; }
interface GeminiResponse { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }>; error?: { message?: string }; }
export interface GeminiVerificationAttempt { result?: EvidenceResult; diagnostic: PipelineDiagnostic; }

export async function verifyWithGeminiSearch(claim: Claim, documentText: string): Promise<GeminiVerificationAttempt> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it";
  if (!apiKey) return { diagnostic: { stage: "gemini_search", status: "unavailable", message: "Gemini API 키가 없어 Google 검색 기반 검증을 실행하지 못했습니다." } };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `다음 한국어 주장을 Google 검색으로 검증하세요.
정부·공공기관·공식 통계·원문을 우선하고 날짜·대상·단위·수치를 비교하세요.
직접 입증하거나 반박하는 근거가 없으면 insufficient로 판정하세요.
검색 후 마지막에는 아래 형식의 JSON 객체만 출력하세요.

문서 맥락:
${documentText.slice(0,1500)}

검증할 주장:
${claim.text}

형식: {"assessment":"supported|conflict|insufficient","summary":"근거 비교 결과","problematicPart":"문제 표현 또는 빈 문자열","correction":"교정 문장 또는 빈 문자열"}` }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1, maxOutputTokens: 768 } }),
    });
    const data = await response.json() as GeminiResponse;
    if (!response.ok) throw new Error(data.error?.message || `Gemini HTTP ${response.status}`);
    const candidate = data.candidates?.[0]; const raw = candidate?.content?.parts?.map(part => part.text || "").join("\n") || ""; const payload = parsePayload(raw); const assessment = normalize(payload.assessment); const sources = extractSources(candidate?.groundingMetadata?.groundingChunks || []);
    if (assessment === "insufficient") return { diagnostic: { stage: "gemini_search", status: "no_result", message: "Gemma Google 검색은 완료됐지만 직접적인 근거가 충분하지 않습니다." } };
    if (!sources.length) return { diagnostic: { stage: "gemini_search", status: "failed", message: "Gemma가 판정은 반환했지만 검색 출처를 제공하지 않았습니다." } };
    return { result: { status: "evidence", claim, assessment, summary: payload.summary?.trim() || "Google 검색 근거와 주장을 비교했습니다.", problematicPart: payload.problematicPart?.trim() || undefined, correction: payload.correction?.trim() || undefined, sources }, diagnostic: { stage: "gemini_search", status: "ok", message: `Gemma Google 검색에서 출처 ${sources.length}건을 확인했습니다.` } };
  } catch (error) { return { diagnostic: { stage: "gemini_search", status: "failed", message: "Gemma Google 검색 호출에 실패했습니다.", detail: error instanceof Error ? error.message : String(error) } }; }
}
function extractSources(chunks: Array<{ web?: { uri?: string; title?: string } }>): EvidenceSource[] { const sources = chunks.flatMap(chunk => chunk.web?.uri ? [{ url: chunk.web.uri, title: chunk.web.title || chunk.web.uri }] : []); return [...new Map(sources.map(source => [source.url, source])).values()].slice(0, 8); }
function parsePayload(raw: string): Payload { const match = raw.match(/\{[\s\S]*\}/); if (!match) return {}; try { return JSON.parse(match[0]) as Payload; } catch { return {}; } }
function normalize(value?: string): EvidenceAssessment { return value === "supported" || value === "conflict" ? value : "insufficient"; }

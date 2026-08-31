import { Claim, EvidenceAssessment, EvidenceResult, PipelineDiagnostic } from "../types";
import { SearchEvidence } from "./searchPublicWeb";

interface Payload {
  assessment?: EvidenceAssessment;
  summary?: string;
  problematicPart?: string;
  correction?: string;
  sourceIndexes?: number[];
}

export interface GemmaEvidenceAttempt {
  result?: EvidenceResult;
  diagnostic: PipelineDiagnostic;
}

export async function verifyWithGemmaEvidence(claim: Claim, evidence: SearchEvidence[]): Promise<GemmaEvidenceAttempt> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemma-4-26b-a4b-it";
  if (!apiKey || !model.startsWith("gemma-")) {
    return { diagnostic: { stage: "gemma_analysis", status: "unavailable", message: "AI GMS 판정 모델이 설정되지 않았습니다." } };
  }

  const sources = evidence.slice(0, 6);
  const sourceText = sources.map((source, index) =>
    `[${index + 1}] ${source.title}\n${source.snippet.slice(0, 1000)}\n${source.url}`
  ).join("\n\n");

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 헬스체크의 짧은 ping(수 토큰)도 9초 넘게 걸린 적이 있는데, 이 호출은 검색결과 6건을
      // 요약해 비교하는 훨씬 긴 프롬프트라 15초로는 자주 타임아웃됐다.
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: `아래 검색 자료만 사용해 주장을 검증하세요. AI가 직접 검색했다고 말하지 마세요. 직접 근거가 부족하면 insufficient로 판정하세요. JSON만 출력하세요.\n\n주장:\n${claim.text}\n\n검색 자료:\n${sourceText}\n\n형식: {"assessment":"supported|conflict|insufficient","summary":"비교 결과","problematicPart":"문제 표현 또는 빈 문자열","correction":"교정 문장 또는 빈 문자열","sourceIndexes":[1,2]}` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 768 },
      }),
    });
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || `AI GMS HTTP ${response.status}`);
    const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
    const payload = parsePayload(raw);
    const assessment = payload.assessment === "supported" || payload.assessment === "conflict" ? payload.assessment : "insufficient";
    const selected = (payload.sourceIndexes || [])
      .filter((index) => Number.isInteger(index) && index > 0 && index <= sources.length)
      .map((index) => sources[index - 1]);
    const visibleSources = (selected.length ? selected : sources).map(({ title, url }) => ({ title, url }));
    return {
      result: {
        status: "evidence",
        claim,
        assessment,
        summary: payload.summary?.trim() || "검색 자료와 주장을 비교했습니다.",
        problematicPart: assessment === "insufficient" ? undefined : payload.problematicPart?.trim() || undefined,
        correction: assessment === "insufficient" ? undefined : payload.correction?.trim() || undefined,
        sources: visibleSources,
      },
      diagnostic: { stage: "gemma_analysis", status: "ok", message: `AI GMS가 외부 검색 자료 ${visibleSources.length}건을 비교했습니다.` },
    };
  } catch (error) {
    return { diagnostic: { stage: "gemma_analysis", status: "failed", message: "AI GMS의 검색 자료 판정에 실패했습니다.", detail: error instanceof Error ? error.message : String(error) } };
  }
}

function parsePayload(raw: string): Payload {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]) as Payload; } catch { return {}; }
}

export type InputType = "text" | "url";

export interface Claim {
  id: string;
  text: string;
}

export interface OfficialItem {
  id: string;
  contentType: string; // e.g. "사실확인" for the '사실은 이렇습니다' corner, "보도자료" for press releases
  title: string;
  body: string;
  agency: string;
  date: string; // YYYY-MM-DD
  url: string;
}

export type Verdict = "conflict" | "supported"; // 🔴 상충 / 🟢 근거있음 — 원문에서 파싱된 결론일 뿐 AI 신규판정 아님

export interface MatchedResult {
  status: "matched";
  claim: Claim;
  verdict: Verdict;
  excerpt: string;
  source: OfficialItem;
}

export type EvidenceAssessment = "supported" | "conflict" | "insufficient";

export interface EvidenceSource {
  title: string;
  url: string;
}

export interface EvidenceIssue {
  phrase: string;
  reason: string;
  sources: EvidenceSource[];
}

export interface EvidenceResult {
  status: "evidence";
  claim: Claim;
  assessment: EvidenceAssessment;
  summary: string;
  problematicPart?: string;
  correction?: string;
  sources: EvidenceSource[];
  issues?: EvidenceIssue[];
}

export type FailureStage = "claim_extraction" | "policy_api" | "claude_search" | "gemini_search" | "gemma_analysis" | "web_search" | "local_ai";

export interface PipelineDiagnostic {
  stage: FailureStage;
  status: "ok" | "failed" | "unavailable" | "no_result";
  message: string;
  detail?: string;
}

export interface VerificationErrorResult {
  status: "error";
  claim: Claim;
  stage: FailureStage;
  title: string;
  message: string;
  retryable: boolean;
}

export type ClaimResult = MatchedResult | EvidenceResult | VerificationErrorResult;

export interface TtaStandardCheck {
  standard: string;
  clause: string;
  title: string;
  detail: string;
  status: "applied" | "warning";
}

export interface AnalyzeResponse {
  claims: Claim[];
  results: ClaimResult[];
  qualityWarning?: string;
  ttaChecks: TtaStandardCheck[];
  diagnostics: PipelineDiagnostic[];
}

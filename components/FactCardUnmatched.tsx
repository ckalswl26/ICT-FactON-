import { Fragment } from "react";
import { EvidenceResult } from "@/lib/types";

const labels = {
  supported: { title: "근거로 확인", lead: "주요 내용이 확인된 근거와 일치합니다.", symbol: "✓" },
  conflict: { title: "근거와 상충", lead: "주장에 다르거나 과장된 부분이 있습니다.", symbol: "!" },
  insufficient: { title: "근거 불충분", lead: "검색은 완료됐지만 판단할 직접 근거가 충분하지 않습니다.", symbol: "?" },
} as const;

// problematicPart(쉼표로 여러 개일 수 있음)가 주장 문장 안에 그대로 들어있으면 빨간
// 취소선으로 표시해, 어디가 왜 틀렸는지 문장만 보고도 바로 알 수 있게 한다.
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderClaimText(text: string, problematicPart?: string) {
  if (!problematicPart) return text;
  const phrases = [...new Set(problematicPart.split(", ").map((p) => p.trim()).filter(Boolean))];
  if (!phrases.length) return text;
  const pattern = new RegExp(`(${phrases.map(escapeRegExp).join("|")})`, "g");
  return text.split(pattern).map((part, i) =>
    phrases.includes(part) ? <mark className="claim-wrong" key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>
  );
}

export default function FactCardUnmatched({ result, index }: { result: EvidenceResult; index: number }) {
  const assessment = result.assessment in labels ? result.assessment : "insufficient";
  const label = labels[assessment];
  const sources = Array.isArray(result.sources) ? result.sources : [];
  const issues = Array.isArray(result.issues) ? result.issues : [];
  const claimText = result.claim?.text || "주장 내용을 불러오지 못했습니다.";
  return <article className={`result-card evidence-${assessment}`}>
    <div className="result-topline"><span className="claim-number">CLAIM {String(index).padStart(2, "0")}</span><span className="result-status"><i>{label.symbol}</i>{label.title}</span></div>
    <h3>“{assessment === "conflict" ? renderClaimText(claimText, result.problematicPart) : claimText}”</h3>
    <div className="verdict-box"><strong>{label.lead}</strong><p>{result.summary || "상세 판정 설명이 제공되지 않았습니다."}</p></div>
    {result.problematicPart && <div className="problem-box"><span>틀린 부분</span><strong>“{result.problematicPart}”</strong></div>}
    {issues.map((issue, i) => <div className="issue-item" key={`${issue.phrase}-${i}`}><div className="issue-phrase"><span>문제 표현</span><strong>{issue.phrase}</strong></div><p>{issue.reason}</p>{(issue.sources || []).map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>판단 근거 · {source.title} ↗</a>)}</div>)}
    {result.correction && <div className="correction-box"><span>✓ 올바른 정보</span><p>{result.correction}</p></div>}
    <div className="evidence-sources"><span className="related-title">확인한 출처 {sources.length ? `${sources.length}건` : ""}</span>{sources.length ? sources.map((source, i) => <a className="evidence-source" href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${i}`}><span>{i + 1}</span><strong>{source.title}</strong><i>↗</i></a>) : <p className="no-sources">표시할 수 있는 검증 출처가 없습니다.</p>}</div>
    <p className="evidence-disclaimer">공개 자료를 바탕으로 한 근거 검색 결과입니다. 중요한 의사결정 전에는 원문을 직접 확인해 주세요.</p>
  </article>;
}

import { NextRequest, NextResponse } from "next/server";
import { checkInputQuality } from "@/lib/quality/checkInputQuality";
import { extractClaims } from "@/lib/claims/extractClaims";
import { extractArticle } from "@/lib/url/extractArticle";
import { searchFactCheck, WINDOW_DAYS } from "@/lib/match/policyNewsClient";
import { matchClaim } from "@/lib/match/matchClaims";
import { parseVerdict } from "@/lib/match/parseVerdictFromSource";
import { verifyClaim } from "@/lib/evidence/verifyClaim";
import { maskPII } from "@/lib/privacy/maskPII";
import { AnalyzeResponse, ClaimResult, InputType, TtaStandardCheck } from "@/lib/types";

function buildTtaChecks(results: ClaimResult[], qualityWarning?: string): TtaStandardCheck[] {
  const hasInsufficientEvidence = results.some(
    (result) => result.status === "evidence" && result.assessment === "insufficient",
  );

  return [
    { standard: "TTAK.KO-10.1344-Part2", clause: "6.3, 7.4", title: "텍스트 품질 점검", detail: qualityWarning ? `입력 품질 경고가 있습니다: ${qualityWarning}` : "입력 길이와 분석 가능 여부를 확인하고 텍스트의 의미 정확성 검토 대상으로 처리했습니다.", status: qualityWarning ? "warning" : "applied" },
    { standard: "TTAK.KO-10.1419", clause: "5, 6.4", title: "주장·개체명 및 근거 연결", detail: hasInsufficientEvidence ? "근거 문단에서 답을 확인할 수 없는 주장은 거짓으로 단정하지 않고 ‘근거 불충분’으로 보류했습니다." : "주장을 문장 단위로 분리하고, 답변이 표시된 근거와 연결되는지 확인했습니다.", status: hasInsufficientEvidence ? "warning" : "applied" },
    { standard: "TTAK.KO-10.1497", clause: "REQ.04·05·11·13·14", title: "출처 추적과 설명 가능성", detail: "판정 이유와 원문 링크를 함께 표시하며, 근거가 부족하거나 검색에 실패하면 안전하게 보류합니다.", status: hasInsufficientEvidence ? "warning" : "applied" },
    { standard: "TTAK.KO-12.0414", clause: "7.3.1~7.3.5", title: "개인정보 최소 처리", detail: "표시 결과의 전화번호·이메일·주민등록번호를 마스킹하며 입력 원문은 서버에 저장하지 않습니다.", status: "applied" },
  ];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const type = body?.type as InputType | undefined;
  const content = body?.content as string | undefined;

  if (!type || !content?.trim()) {
    return NextResponse.json({ error: "type과 content는 필수입니다." }, { status: 400 });
  }

  let text: string;
  try {
    text = type === "url" ? await extractArticle(content.trim()) : content;
  } catch (e) {
    const message = e instanceof Error ? e.message : "URL 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const qualityWarning = checkInputQuality(text);
  const analyzedText = text.length > 8000 ? text.slice(0, 8000) : text;

  try {
    const extraction = await extractClaims(analyzedText);
    const claims = extraction.claims;
    const diagnostics = [extraction.diagnostic];

    // Policy data is independent of an individual claim. Fetch it once, then
    // verify all claims concurrently instead of repeating the whole pipeline.
    const policy = await Promise.race([
      searchFactCheck(claims[0]?.text ?? ""),
      new Promise<Awaited<ReturnType<typeof searchFactCheck>>>((resolve) => setTimeout(() => resolve({
        items: [],
        diagnostic: {
          stage: "policy_api",
          status: "unavailable",
          message: `정책뉴스 ${WINDOW_DAYS}일 자료를 백그라운드에서 갱신 중입니다. 이번 분석은 AI·공개 웹 검색을 우선 사용합니다.`,
        },
        elapsedMs: 5000,
        requests: 0,
      }), 5000)),
    ]);
    diagnostics.push(policy.diagnostic);

    const verificationTasks = claims.map(async (claim) => {
        const matched = await matchClaim(claim, policy.items);

        if (matched) {
          const { verdict, excerpt } = parseVerdict(matched);
          const result: ClaimResult = {
            status: "matched",
            claim,
            verdict,
            excerpt: maskPII(excerpt),
            source: { ...matched, body: maskPII(matched.body) },
          };
          return { result, diagnostics: [] };
        }

        const verification = await verifyClaim(claim, analyzedText);
        return { result: verification.result, diagnostics: verification.diagnostics };
    });
    const verified = await Promise.all(verificationTasks);
    const results = verified.map((item) => item.result);
    diagnostics.push(...verified.flatMap((item) => item.diagnostics));

    const uniqueDiagnostics = [...new Map(diagnostics.map(item => [`${item.stage}:${item.status}:${item.message}`, item])).values()];
    const response: AnalyzeResponse = { claims, results, qualityWarning, ttaChecks: buildTtaChecks(results, qualityWarning), diagnostics: uniqueDiagnostics };
    return NextResponse.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

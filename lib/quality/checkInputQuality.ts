// [TTAK.KO-10.1344-Part2 6.3, 7.4]
// 비정형 텍스트의 유효성·의미 정확성 검토에 앞서 분석 가능한 최소 길이와 처리 한도를 확인한다.
// 이는 표준 전체 적합성 인증이 아니라 해당 품질지표를 서비스 입력 단계에 적용한 것이다.
export function checkInputQuality(text: string): string | undefined {
  const trimmed = text.trim();
  if (trimmed.length < 5) {
    return "입력 내용이 너무 짧아 주장을 추출하기 어렵습니다. 조금 더 자세히 붙여넣어 주세요.";
  }
  if (trimmed.length > 8000) {
    return "입력 내용이 너무 길어 앞부분 8000자 기준으로만 분석합니다.";
  }
  return undefined;
}

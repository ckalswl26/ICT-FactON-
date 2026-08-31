// [TTAK.KO-12.0414] AI 서비스 개인정보보호 프레임워크의 일반 원칙(수집 최소화·노출 최소화)에 부합하도록,
// 화면에 노출되는 텍스트에서 전화번호·주민등록번호 패턴을 마스킹한다.
// MVP 범위: 텍스트 단계만 처리. 이미지·영상 속 얼굴 등 마스킹은 우선순위 낮음(범위 밖)으로 기획서에 명시됨.
const PHONE_PATTERN = /(01[016789])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g;
const RRN_PATTERN = /(\d{6})[-\s]?[1-4]\d{6}/g;

export function maskPII(text: string): string {
  return text
    .replace(PHONE_PATTERN, (_m, p1) => `${p1}-****-****`)
    .replace(RRN_PATTERN, (_m, p1) => `${p1}-*******`);
}

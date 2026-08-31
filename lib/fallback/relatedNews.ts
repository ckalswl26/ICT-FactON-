import { OfficialItem } from "../types";
import { searchAll } from "../match/policyNewsClient";

const MAX_RELATED = 3;

// 2차 fallback: '사실확인' 매칭 실패 시 관련 정책뉴스(보도자료 포함 콘텐츠 유형)를 참고자료로만 제시한다.
// 여기서는 절대 🔴/🟢을 부여하지 않는다 — 호출부(app/api/analyze)에서 항상 판정보류(⚪)로 표시.
export async function findRelated(query: string): Promise<OfficialItem[]> {
  const news = await searchAll(query);
  return news.items.slice(0, MAX_RELATED);
}

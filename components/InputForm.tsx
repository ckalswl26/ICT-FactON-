"use client";
import { useState } from "react";
import { InputType } from "@/lib/types";
interface Props { onSubmit: (type: InputType, content: string) => void; loading: boolean; }
const samples = ["2026년부터 모든 국민에게 매달 50만 원의 기본소득이 지급된다.", "전기차는 내연기관차보다 화재가 더 자주 발생한다.", "한국의 출산율이 최근 10년 만에 처음으로 반등했다."];
export default function InputForm({ onSubmit, loading }: Props) {
  const [type, setType] = useState<InputType>("text"); const [content, setContent] = useState(""); const maxLength = 5000;
  const submit = () => content.trim() && onSubmit(type, content.trim());
  return <div className="input-card">
    <div className="card-heading"><div><span className="step-label">NEW CHECK</span><span className="live-label"><i /> 실시간 분석</span></div><h2>확인하고 싶은 정보를 알려주세요</h2><p>문장, 메시지 또는 뉴스 링크를 입력하면 주장별로 나누어 공개 근거와 비교합니다.</p></div>
    <div className="input-tabs" role="tablist" aria-label="입력 방식 선택"><button type="button" role="tab" aria-selected={type === "text"} onClick={() => { setType("text"); setContent(""); }} className={type === "text" ? "active" : ""}><span>Aa</span>직접 입력</button><button type="button" role="tab" aria-selected={type === "url"} onClick={() => { setType("url"); setContent(""); }} className={type === "url" ? "active" : ""}><span>↗</span>뉴스 URL</button></div>
    <label className="field-label" htmlFor="fact-input">{type === "text" ? "확인할 내용" : "뉴스 또는 게시물 주소"}<span>필수</span></label>
    {type === "text" ? <div className="textarea-wrap"><textarea id="fact-input" maxLength={maxLength} placeholder="기사나 단체 채팅방에서 본 내용을 그대로 붙여넣어 주세요. 여러 문장도 한 번에 분석할 수 있어요." value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit(); }} /><span className="char-count">{content.length.toLocaleString()} / {maxLength.toLocaleString()}자</span></div> : <input id="fact-input" className="url-input" type="url" inputMode="url" placeholder="https://example.com/news/..." value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />}
    {type === "text" && <div className="sample-area"><span>빠른 예시</span><div>{samples.map((sample, i) => <button type="button" key={sample} onClick={() => setContent(sample)}>예시 {i + 1}</button>)}</div></div>}
    <button className="submit-button" type="button" disabled={loading || !content.trim()} onClick={submit}><span>⌁</span>{loading ? "공개 근거를 찾는 중입니다" : "근거 분석 시작하기"}<kbd>⌘ Enter</kbd></button><p className="privacy-note"><span>▣</span> 입력 내용은 분석 후 저장하지 않습니다.</p>
  </div>;
}

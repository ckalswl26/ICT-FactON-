"use client";
import { useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

type Answer = "yes" | "no" | null;
const questions = [
  "제목뿐 아니라 본문 전체를 읽는 편인가요?",
  "작성자·언론사·게시 날짜를 확인하나요?",
  "주장을 뒷받침하는 원문이나 통계를 찾아보나요?",
  "다른 신뢰할 만한 출처도 같은 내용을 전하는지 비교하나요?",
  "분노나 불안을 느껴도 바로 공유하지 않고 잠시 멈추나요?",
];

function resultFor(score: number) {
  if (score >= 80) return { level: "매우 탄탄해요", tone: "excellent", text: "정보를 비판적으로 읽고 교차 확인하는 습관이 잘 자리 잡혀 있어요. 지금처럼 원문과 맥락을 함께 확인해 보세요." };
  if (score >= 60) return { level: "좋은 편이에요", tone: "good", text: "기본적인 확인 습관을 갖고 있어요. 놓친 항목을 한두 번 더 실천하면 더 안전하게 정보를 판단할 수 있습니다." };
  if (score >= 40) return { level: "성장 중이에요", tone: "growing", text: "정보를 확인하려는 태도는 있지만 몇 가지 습관을 더 익히면 좋아요. 출처와 다른 보도를 함께 확인해 보세요." };
  return { level: "연습이 필요해요", tone: "practice", text: "정보를 바로 믿거나 공유하기 전에 잠시 멈추는 연습부터 시작해 보세요. 아래 세 가지 읽기 원칙이 도움이 됩니다." };
}

export default function LiteracyPage() {
  const [answers, setAnswers] = useState<Answer[]>(questions.map(() => null));
  const [revealed, setRevealed] = useState(false);
  const answered = answers.filter(Boolean).length;
  const score = useMemo(() => answers.filter(answer => answer === "yes").length * 20, [answers]);
  const result = resultFor(score);
  const choose = (index: number, answer: Exclude<Answer, null>) => { setAnswers(value => value.map((item, i) => i === index ? answer : item)); setRevealed(false); };
  const reset = () => { setAnswers(questions.map(() => null)); setRevealed(false); };

  return <div className="site-shell"><SiteHeader /><main>
    <section className="detail-hero"><p>MEDIA LITERACY</p><h1>나의 정보 읽기 습관은 몇 점일까요?</h1><span>다섯 가지 질문에 답하고 미디어 리터러시 점수와 맞춤 안내를 확인해 보세요.</span></section>
    <section className="literacy-section page-section"><div className="section-intro"><div><p className="section-kicker">CHECK BEFORE SHARE</p><h2>좋은 판단은 좋은 질문에서 시작됩니다</h2></div><p>미디어 리터러시는 정보를 무조건 의심하는 태도가 아니라, 누가 왜 만들었는지 살피고 근거를 확인한 뒤 책임 있게 이용하는 능력입니다.</p></div>
      <div className="literacy-board"><div className="checklist-card quiz-card"><div className="checklist-head"><span>{answered}/5</span><div><strong>미디어 리터러시 자가진단</strong><small>평소의 정보 이용 습관을 기준으로 답해 주세요</small></div></div>
        <div className="quiz-progress"><span style={{ width: `${answered * 20}%` }} /></div>
        <div className="quiz-list">{questions.map((label, i) => <fieldset key={label}><legend><i>{i + 1}</i><span>{label}</span></legend><div><button type="button" className={answers[i] === "yes" ? "selected yes" : ""} aria-pressed={answers[i] === "yes"} onClick={() => choose(i, "yes")}>예</button><button type="button" className={answers[i] === "no" ? "selected no" : ""} aria-pressed={answers[i] === "no"} onClick={() => choose(i, "no")}>아니오</button></div></fieldset>)}</div>
        {!revealed ? <button className="score-button" type="button" disabled={answered < questions.length} onClick={() => setRevealed(true)}>{answered < questions.length ? `${questions.length - answered}개 문항에 더 답해 주세요` : "내 점수 확인하기"}</button> : <div className={`literacy-result ${result.tone}`} role="status"><div className="score-ring"><strong>{score}</strong><span>점</span></div><div><small>나의 미디어 리터러시</small><h3>{result.level}</h3><p>{result.text}</p><button type="button" onClick={reset}>다시 진단하기</button></div></div>}
      </div><div className="literacy-lessons"><article><span>SOURCE</span><h3>출처를 거슬러 올라가기</h3><p>검색 결과나 캡처에 머물지 말고 최초 게시물, 공식 발표, 통계 원자료까지 확인하세요.</p></article><article><span>CONTEXT</span><h3>숫자와 맥락 함께 보기</h3><p>기간·표본·비교 기준이 빠진 숫자는 다른 인상을 줄 수 있습니다. 조사 방식도 살펴보세요.</p></article><article><span>PAUSE</span><h3>감정이 클수록 잠시 멈추기</h3><p>놀라움과 분노를 일으키는 콘텐츠일수록 날짜, 출처, 반론을 한 번 더 확인하세요.</p></article><a href="https://www.kpf.or.kr/front/intropage/intropageShow.do?page_id=b6ceaf19077e4b618950fd91bbf49093" target="_blank" rel="noreferrer">한국언론진흥재단 미디어교육 자료 보기 <b>↗</b></a></div></div>
    </section></main></div>;
}

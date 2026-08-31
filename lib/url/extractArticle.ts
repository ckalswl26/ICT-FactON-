import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export async function extractArticle(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (FactON fact-check bot)" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`URL을 불러오지 못했습니다 (status ${res.status})`);
  }
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article?.textContent?.trim()) {
    throw new Error("본문을 추출하지 못했습니다.");
  }
  return article.textContent.trim();
}

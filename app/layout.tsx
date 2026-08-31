import type { Metadata } from "next"; import "./globals.css";
export const metadata: Metadata = { title: "FactON | 근거가 켜지는 순간", description: "뉴스와 메시지 속 주장을 공개 자료와 비교하고 출처와 근거를 투명하게 안내합니다." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}</body></html>; }

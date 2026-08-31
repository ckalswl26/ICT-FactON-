import type { Metadata } from "next";
export const metadata: Metadata = { title: "정보 읽기 | FactON", description: "출처와 맥락을 확인하고 정보를 책임 있게 공유하는 미디어 리터러시 안내" };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menus = [
  { href: "/", label: "팩트 체크" },
  { href: "/literacy", label: "정보 읽기" },
  { href: "/report", label: "신고 안내" },
  { href: "/how", label: "이용 방법" },
  { href: "/sources", label: "정책·뉴스" },
];

export default function SiteHeader({ onHome }: { onHome?: () => void }) {
  const pathname = usePathname();
  return <header className="site-header"><div className="header-inner">
    <Link className="brand" href="/" onClick={onHome}><span className="brand-mark">F</span><span className="brand-name">Fact<span>ON</span></span><span className="brand-divider" /><span className="brand-description">근거가 켜지는 순간</span></Link>
    <nav>{menus.map(menu => <Link key={menu.href} className={pathname === menu.href ? "active" : ""} href={menu.href} onClick={menu.href === "/" ? onHome : undefined}>{menu.label}</Link>)}<span className="header-badge"><i /> 서비스 정상</span></nav>
  </div></header>;
}

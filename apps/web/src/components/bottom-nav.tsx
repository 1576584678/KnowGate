"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Settings } from "lucide-react";

const links = [
  { href: "/", label: "闯关", icon: Home },
  { href: "/growth", label: "成长", icon: BarChart3 },
  { href: "/settings", label: "设置", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="主导航">
      <div className="bottom-nav__inner">
        {links.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              className="bottom-nav__link"
              data-active={active}
              href={item.href}
              key={item.href}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getInboxBadge } from "@/lib/campus-api";

interface MobileNavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

const ITEMS: MobileNavItem[] = [
  { id: "ideas", label: "Ideas", icon: "lightbulb", href: "/ideas" },
  { id: "people", label: "People", icon: "group", href: "/people" },
  { id: "problems", label: "Problems", icon: "flag", href: "/problems" },
  { id: "inbox", label: "Inbox", icon: "inbox", href: "/inbox" },
  { id: "saved", label: "Saved", icon: "bookmark", href: "/saved" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { token } = useAuth();
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    if (!token) {
      setBadge(0);
      return;
    }
    let cancelled = false;
    const pull = () => {
      getInboxBadge(token)
        .then((data) => { if (!cancelled) setBadge(data.count); })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-[#e4e2ee] px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_3px_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {ITEMS.map((item) => {
            const active = isActive(item.href);
            const activeColor = item.id === "problems" ? "text-[#b45309]" : "text-[#4f46e5]";
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.id === "inbox" && badge > 0 ? `Inbox, ${badge} waiting` : item.label}
                className={`relative flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-lg transition-colors ${
                  active
                    ? activeColor
                    : "text-[#777587] hover:text-[#141b2b] active:text-[#141b2b]"
                }`}
              >
                <span className="relative">
                  <span
                    className={`material-symbols-outlined text-[21px] transition-transform ${
                      active ? "scale-105 font-bold" : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.id === "inbox" && badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#4f46e5] text-white text-[9px] font-bold flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] tracking-tight mt-0.5 leading-none ${
                    active ? `font-semibold ${activeColor}` : "font-medium text-[#777587]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
        })}
      </div>
    </nav>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getInboxBadge } from "@/lib/campus-api";
import AttestSeal from "@/components/brand/AttestSeal";

interface NavbarProps {
  hasSidebar?: boolean;
}

export default function Navbar({ hasSidebar = false }: NavbarProps) {
  const { user, token, isLoading, logout } = useAuth();
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("");
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

  const runSearch = () => {
    const q = searchValue.trim();
    if (!user) {
      router.push(q ? `/login?next=${encodeURIComponent(`/ideas?tab=latest&q=${encodeURIComponent(q)}`)}` : "/login");
      return;
    }
    router.push(q ? `/ideas?tab=latest&q=${encodeURIComponent(q)}` : "/ideas");
  };

  return (
    <>
      <header
        className={`fixed top-0 right-0 h-16 z-40 flex items-center justify-between px-5
          bg-[#ffffff]/90 backdrop-blur-md
          shadow-[0_1px_0_0_rgba(199,196,216,0.6)]
          transition-all duration-150 ease-out
          ${hasSidebar ? "md:left-[220px] left-0" : "left-0"}`}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link
            href="/"
            id="navbar-logo"
            className={`items-center gap-2 shrink-0 group ${hasSidebar ? "flex md:hidden" : "flex"}`}
          >
            <AttestSeal size={28} className="text-[#4f46e5] transition-transform duration-200 group-hover:rotate-[-8deg]" />
            <span className="font-serif font-bold text-[17px] text-[#141b2b] tracking-tight">
              Attest
            </span>
          </Link>

          <div className="relative flex-1 max-w-md hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#777587] text-[18px] pointer-events-none">
              search
            </span>
            <input
              id="navbar-search"
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
              placeholder="Search ideas by title…"
              className="w-full pl-9 pr-12 py-1.5 bg-[#f1f3ff]/70 rounded-lg
                shadow-[inset_0_0_0_1px_rgba(199,196,216,0.8)]
                text-[13px] text-[#141b2b] placeholder:text-[#777587]
                focus:outline-none focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#4f46e5]
                transition-all duration-150"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-[#777587] bg-white px-1.5 py-0.5 rounded shadow-[0_0_0_1px_rgba(199,196,216,0.8)] pointer-events-none">
              ↵
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-3">
          {isLoading ? (
            <div className="h-7 w-24 bg-[#e9edff] animate-pulse rounded-lg" />
          ) : user ? (
            <>
              <button
                type="button"
                id="navbar-notifications"
                title="Inbox"
                aria-label={badge > 0 ? `Inbox, ${badge} waiting` : "Open inbox"}
                onClick={() => router.push("/inbox")}
                className="relative p-2 text-[#464555] hover:text-[#141b2b] rounded-lg hover:bg-[#f1f3ff] transition-colors duration-150"
              >
                <span className="material-symbols-outlined text-[20px]">inbox</span>
                {badge > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#4f46e5] text-white text-[10px] font-bold flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </button>

              <div className="flex items-center pl-2 border-l border-[#c7c4d8]/60 ml-1">
                <Link
                  href={`/profile/${user.id}`}
                  id="navbar-profile"
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#f1f3ff] transition-colors duration-150 group"
                >
                  <div className="w-8 h-8 rounded-full bg-[#e9edff] border border-[#c7c4d8]/60 text-[#4f46e5] flex items-center justify-center text-[12px] font-bold transition-transform duration-150 group-hover:scale-105">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="hidden sm:block text-[11px] font-medium text-[#777587] hover:text-[#141b2b] px-2 py-1 transition-colors duration-150 cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            /* Unauthenticated */
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-[13px] font-medium text-[#464555] hover:text-[#141b2b] px-3 py-1.5 transition-colors duration-150"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="text-[13px] font-semibold text-white bg-[#4f46e5] hover:bg-[#3525cd] px-3.5 py-1.5 rounded-lg shadow-sm transition-all duration-150 ease-out active:scale-[0.98]"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </header>
    </>
  );
}

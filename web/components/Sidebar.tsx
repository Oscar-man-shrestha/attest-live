"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AttestSeal from "@/components/brand/AttestSeal";

type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  authRequired?: boolean;
  adminOnly?: boolean;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const profileHref = user ? `/profile/${user.id}` : "/profile";
  const displayName = user?.displayName || user?.username || "";
  const subtitle = user
    ? [user.branch, user.semester ? `Sem ${user.semester}` : null].filter(Boolean).join(" · ") || "Finish your profile"
    : "";

  const goToLogin = (next: string) => {
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const navItems: (NavItem & { hint?: string })[] = [
    { id: "ideas", label: "Ideas", icon: "lightbulb", href: "/ideas", hint: "Builds seeking teammates" },
    { id: "people", label: "People", icon: "group", href: "/people", authRequired: true },
    { id: "problems", label: "Problems", icon: "flag", href: "/problems", hint: "Pains needing a builder" },
    { id: "gigs", label: "Gigs", icon: "bolt", href: "/gigs", authRequired: true, hint: "Quick paid or credit work" },
    { id: "saved", label: "Saved", icon: "bookmark", href: "/saved", authRequired: true },
    { id: "deals", label: "Deals", icon: "handshake", href: "/deals", authRequired: true, hint: "Milestones and payments" },
    { id: "inbox", label: "Inbox", icon: "inbox", href: "/inbox" },
    { id: "proof", label: "Proof", icon: "verified", href: "/proof" },
    { id: "reports", label: "Reports", icon: "report", href: "/reports", adminOnly: true },
    { id: "help", label: "Help", icon: "help", href: "/help" },
  ];

  const visible = navItems.filter((item) => !item.adminOnly || user?.isAdmin);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      aria-label="Sidebar Navigation"
      className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] z-50 flex-col justify-between
        bg-surface-container-lowest
        border-r border-outline-variant/30
        shadow-xs"
    >
      <div className="flex flex-col">
        <div className="h-16 px-4 flex items-center justify-between border-b border-outline-variant/20">
          <Link href="/" className="flex items-center gap-2.5 group">
            <AttestSeal size={30} className="text-[#4f46e5] transition-transform duration-200 group-hover:rotate-[-8deg]" />
            <span className="font-serif font-bold text-[16px] text-on-surface tracking-tight">
              Attest
            </span>
          </Link>
        </div>

        <div className="p-3">
          <Link
            id="sidebar-create-idea"
            href="/ideas/new"
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                goToLogin("/ideas/new");
              }
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl
              bg-primary-container hover:bg-primary text-on-primary text-[13px] font-ui-medium
              shadow-sm transition-all duration-150 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Post idea</span>
          </Link>
        </div>

        <div className="px-4 py-1.5">
          <span className="font-meta-xs text-[11px] font-semibold uppercase tracking-wider text-outline">
            Workspace
          </span>
        </div>

        <nav className="flex flex-col gap-1 px-2.5">
          {visible.map((item) => {
            const active = isActive(item.href);
            const accent =
              item.id === "problems"
                ? active
                  ? "bg-[#fff7ed] text-[#b45309] font-semibold shadow-[inset_2px_0_0_0_#b45309]"
                  : "text-on-surface-variant hover:bg-[#fffbf5] hover:text-[#b45309]"
                : item.id === "gigs" || item.id === "deals"
                  ? active
                    ? "bg-[#ecfdf5] text-[#047857] font-semibold shadow-[inset_2px_0_0_0_#047857]"
                    : "text-on-surface-variant hover:bg-[#f0fdf4] hover:text-[#047857]"
                : active
                  ? "bg-surface-container-high text-primary font-semibold shadow-[inset_2px_0_0_0_#4f46e5]"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface";
            return (
              <Link
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                href={item.href}
                title={item.hint}
                onClick={item.authRequired && !user ? (event) => {
                  event.preventDefault();
                  goToLogin(item.href);
                } : undefined}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-ui-medium transition-all duration-150 ${accent}`}
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block leading-tight">{item.label}</span>
                  {item.hint && (
                    <span className="block text-[10px] font-normal text-[#777587] truncate leading-tight mt-0.5">
                      {item.hint}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-outline-variant/30 bg-surface-container-lowest">
        {user ? (
          <div className="flex items-center justify-between gap-1">
            <Link
              href={profileHref}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-surface-container-low transition-colors duration-150 group flex-1 min-w-0"
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-[12px] font-bold shadow-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-on-surface truncate group-hover:text-primary transition-colors duration-150">
                  {displayName}
                </p>
                <p className="font-meta-xs text-[10px] text-secondary font-medium truncate">
                  {subtitle}
                </p>
              </div>
            </Link>
            <Link
              href="/profile"
              className="p-1 text-outline hover:text-on-surface rounded transition-colors"
              title="Edit profile"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </Link>
          </div>
        ) : (
          <Link
            href="/login"
            className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-surface-container-low transition-colors duration-150 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-surface-container text-outline flex items-center justify-center text-[12px] font-bold shrink-0">
              ?
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-on-surface truncate">Sign in</p>
              <p className="font-meta-xs text-[10px] text-outline truncate">University email code</p>
            </div>
          </Link>
        )}
      </div>
    </aside>
  );
}

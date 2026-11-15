"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

/**
 * AppShell — Stitch "Quiet Signal" layout
 *
 * Structure:
 *   ┌──────────────────────────────────────┐
 *   │  Sidebar (fixed, 220px, full-height) │
 *   │  Header  (fixed, top-0, left-220px)  │
 *   │  Main    (pl-[220px] pt-16)          │
 *   └──────────────────────────────────────┘
 *
 * When the user is unauthenticated the sidebar is hidden and the header
 * spans full width (left-0).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasSidebar = Boolean(user);

  useEffect(() => {
    if (isLoading) return;
    const path = pathname || "/";
    const open = path === "/" || path.startsWith("/login") || path.startsWith("/invite/") || path === "/rules" || path === "/pricing";
    if (!user && !open) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [isLoading, user, pathname, router]);

  return (
    <div className="min-h-screen paper-grid">
      {/* Fixed sidebar — only for authenticated users, hidden on mobile */}
      {hasSidebar && <Sidebar />}

      {/* Fixed top header */}
      <Navbar hasSidebar={hasSidebar} />

      {/* Main content area — offset for fixed sidebar + fixed header */}
      <main
        className={`min-h-screen pt-16 transition-all duration-150 ease-out ${
          hasSidebar ? "md:pl-[220px] pb-20 md:pb-6" : "pb-6"
        }`}
      >
        {children}
      </main>

      {/* Fixed bottom navigation on mobile */}
      {hasSidebar && <MobileNav />}
    </div>
  );
}

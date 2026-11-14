"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Public first page for Attest. Signed-in students skip straight to the board.
 * This is the only place a stranger should understand the 14-day sprint.
 */
export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (!user.profileComplete) router.replace("/profile");
    else router.replace("/ideas");
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return <div className="px-5 py-10 text-[14px] text-[#777587]">Loading…</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="relative overflow-hidden border-b border-[#e4e2ee]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_90%_-10%,_#dce2f7_0%,_transparent_55%),radial-gradient(ellipse_60%_50%_at_0%_100%,_#e9edff_0%,_transparent_50%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(20,27,43,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(20,27,43,0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
        />
        <div className="relative mx-auto max-w-5xl px-5 py-16 sm:py-24">
          <p className="animate-rise text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4f46e5]">
            Campus sprint · 14 days
          </p>
          <h1 className="animate-rise delay-1 mt-4 font-serif text-[52px] sm:text-[72px] font-semibold leading-[0.95] tracking-tight text-[#141b2b]">
            Attest
          </h1>
          <p className="animate-rise delay-2 mt-5 max-w-xl text-[18px] sm:text-[20px] leading-relaxed text-[#464555]">
            Post an idea or a campus problem, find classmates who can actually help, ship something small, and keep a signed trail of what you did.
          </p>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-[#464555]">Have a need but no technical plan? Report a Problem. Have a two-week build in mind? Post an Idea with open roles. You can also join a team and prove your contribution.</p>
          <div className="animate-rise delay-3 mt-9 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-[#141b2b] px-5 py-3 text-[14px] font-semibold text-white transition-transform duration-150 hover:bg-[#2a3142] active:scale-[0.98]"
            >
              Continue with college Outlook
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg border border-[#c7c4d8] bg-white/80 backdrop-blur px-5 py-3 text-[14px] font-semibold text-[#141b2b] transition-colors hover:bg-white"
            >
              Or get a code by email
            </Link>
          </div>
          <p className="animate-rise delay-3 mt-4 text-[13px] text-[#777587]">
            Only @bl.students.amrita.edu. Attest is not a university product.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14 grid gap-6 sm:grid-cols-2">
        <div className="animate-rise delay-1 rounded-2xl border border-[#e4e2ee] bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Ideas</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#141b2b]">Builds seeking teammates</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#464555]">
            Share the outcome and roles needed. Choose what stays private, accept teammates, and ship something small with signed proof.
          </p>
          <Link href="/login" className="mt-5 inline-flex text-[13px] font-semibold text-[#4f46e5]">
            Post idea →
          </Link>
        </div>
        <div className="animate-rise delay-2 rounded-2xl border border-[#f3e6d4] bg-[#fffbf5] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">Problems</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#141b2b]">Pains needing a builder</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#464555]">
            Name a campus pain in concrete terms. A builder can propose an idea; you keep source credit and choose whether to join the team.
          </p>
          <Link href="/login" className="mt-5 inline-flex text-[13px] font-semibold text-[#b45309]">
            Report a problem →
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <h2 className="font-serif text-[26px] font-semibold text-[#141b2b]">From a need to something real</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3 text-[14px] text-[#464555]">
          <div><p className="font-semibold text-[#141b2b]">1. Find your role</p><p className="mt-1">Browse campus Problems and Ideas, then offer a specific contribution you can make.</p></div>
          <div><p className="font-semibold text-[#141b2b]">2. Build for two weeks</p><p className="mt-1">Agree on a first task, share progress, and produce a prototype, test, or useful finding.</p></div>
          <div><p className="font-semibold text-[#141b2b]">3. Show your work</p><p className="mt-1">A teammate signs submitted work before it appears as proof. Likes are appreciation, not proof.</p></div>
        </div>
        <p className="mt-7 text-[12px] text-[#777587]">Idea visibility lets owners choose what to share. It does not grant exclusive ownership or prevent similar work.</p>
      </section>
    </div>
  );
}

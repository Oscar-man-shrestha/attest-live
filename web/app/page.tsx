"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AttestSeal from "@/components/brand/AttestSeal";
import Stamp from "@/components/brand/Stamp";

/**
 * Public first page for Attest. Signed-in students skip straight to the board.
 * Identity: lab notebook (graph paper) + proof stamps + receipts. The receipt on the right is an
 * illustration and is labelled as an example; it never shows live or invented platform numbers.
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

  const boards = [
    {
      tone: "text-[#4f46e5]", border: "border-[#dcd9f5]", wash: "bg-white", icon: "lightbulb", label: "Ideas",
      title: "Builds seeking teammates",
      body: "Post a project and the roles you need. Pay per milestone, offer a stipend, make it open source, or give credit.",
      cta: "Post an idea",
    },
    {
      tone: "text-[#b45309]", border: "border-[#f3e6d4]", wash: "bg-[#fffbf5]", icon: "flag", label: "Problems",
      title: "Pains needing a builder",
      body: "Name a real pain in concrete terms. A builder proposes the fix; you keep the source credit.",
      cta: "Report a problem",
    },
    {
      tone: "text-[#047857]", border: "border-[#c9eedd]", wash: "bg-[#f4fdf8]", icon: "bolt", label: "Gigs",
      title: "Quick work, one milestone",
      body: "“Solder this board.” “Review my schematic.” Ask for a small job or list a service, on your campus or anywhere.",
      cta: "Browse gigs",
    },
  ];

  const steps = [
    ["01", "Post or pick", "An idea, a problem or a gig. Choose who sees it: your campus only, or every campus."],
    ["02", "Agree milestones", "Small pieces with a clear deliverable. The builder accepts the terms before work starts."],
    ["03", "Pay directly", "UPI, bank, Payoneer, Wise. Attest never holds the money; both of you confirm each payment."],
    ["04", "Get it stamped", "Accepted work and confirmed payments become proof on both profiles. Reviews unlock together."],
  ];

  return (
    <div className="paper-grid min-h-[calc(100vh-4rem)]">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-14 pb-16 sm:pt-20 grid gap-12 lg:grid-cols-[1.15fr_0.85fr] items-center">
        <div className="min-w-0">
          <p className="animate-rise inline-flex items-center gap-2 text-[#4f46e5]">
            <AttestSeal size={34} />
            <span className="font-serif text-[26px] font-bold tracking-tight text-[#141b2b]">Attest</span>
          </p>
          <h1 className="animate-rise delay-1 mt-6 font-serif text-[44px] sm:text-[64px] font-semibold leading-[1.02] tracking-tight text-[#141b2b]">
            Help build it. <span className="hl-green">Get thanked.</span>
            <br />
            <span className="hl-indigo">Prove it.</span>
          </h1>
          <p className="animate-rise delay-2 mt-6 max-w-xl text-[17px] sm:text-[19px] leading-relaxed text-[#464555]">
            People with ideas meet people who can build. Help on real software and hardware projects, get a coffee as thanks if they want to give one, and keep a stamped record of everything you helped with.
          </p>
          <div className="animate-rise delay-3 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[#141b2b] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[4px_4px_0_0_#4f46e5] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#4f46e5]"
            >
              Sign in free
              <span className="material-symbols-outlined text-[18px]" aria-hidden>arrow_forward</span>
            </Link>
            <a href="#how" className="text-[14px] font-semibold text-[#141b2b] underline decoration-[#4f46e5] decoration-2 underline-offset-4">
              How a deal works
            </a>
          </div>
          <ul className="animate-rise delay-3 mt-7 flex flex-wrap gap-x-5 gap-y-2 serial">
            <li>Any Google account or email</li>
            <li>Builders pay 0%</li>
            <li>We never hold your money</li>
            <li>Not for graded coursework</li>
          </ul>
        </div>

        {/* Example receipt (illustration) */}
        <div className="animate-rise delay-2 relative mx-auto w-full min-w-0 max-w-sm lg:rotate-[1.5deg]">
          <div className="ticket shadow-[0_18px_50px_rgba(20,27,43,0.12)]">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center justify-between">
                <span className="serial">Proof receipt</span>
                <span className="serial">Paid · fixed price</span>
              </div>
              <p className="mt-2 font-serif text-[22px] font-semibold leading-tight text-[#141b2b]">Hostel air-quality node</p>
              <p className="mt-1 text-[13px] text-[#777587]">Built by <span className="font-semibold text-[#141b2b]">@rivet_4821</span> · Verified student</p>
            </div>
            <div className="ticket-tear" />
            <ul className="px-5 py-4 space-y-3 text-[13px]">
              <li className="flex items-start justify-between gap-3">
                <span className="text-[#141b2b]">1 · Sensor node sends readings</span>
                <span className="ledger font-semibold text-[#141b2b]">₹3,000</span>
              </li>
              <li className="flex items-start justify-between gap-3">
                <span className="text-[#141b2b]">2 · Dashboard page live</span>
                <span className="ledger font-semibold text-[#141b2b]">₹2,000</span>
              </li>
              <li className="flex items-start justify-between gap-3 text-[#777587]">
                <span>Payment confirmed by payer and payee</span>
                <span className="ledger">2 / 2</span>
              </li>
            </ul>
            <div className="ticket-tear" />
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="serial">Total confirmed</p>
                <p className="ledger text-[24px] font-bold text-[#141b2b]">₹5,000</p>
              </div>
              <Stamp large thunk icon="verified">Paid · both confirmed</Stamp>
            </div>
          </div>
          <div className="absolute -left-5 -top-4 hidden sm:block">
            <Stamp tone="ink" icon="draw">Signed by teammate</Stamp>
          </div>
          <p className="serial mt-3 text-center">Example · what a proof receipt looks like</p>
        </div>
      </section>

      {/* ── Three boards ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-16 grid gap-5 md:grid-cols-3">
        {boards.map((board) => (
          <Link key={board.label} href="/login" className={`card-lift block rounded-2xl border ${board.border} ${board.wash} p-6`}>
            <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${board.tone}`}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden>{board.icon}</span>
              {board.label}
            </p>
            <h2 className="mt-2 font-serif text-[23px] font-semibold text-[#141b2b]">{board.title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#464555]">{board.body}</p>
            <p className={`mt-5 text-[13px] font-semibold ${board.tone}`}>{board.cta} →</p>
          </Link>
        ))}
      </section>

      {/* ── How a deal works ─────────────────────────────────── */}
      <section id="how" className="border-y border-[#e4e2ee] bg-white/80">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="font-serif text-[30px] font-semibold text-[#141b2b]">From a need to a stamped record</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([n, title, body]) => (
              <li key={n} className="border-l-2 border-[#141b2b] pl-4">
                <p className="ledger text-[13px] font-bold text-[#4f46e5]">{n}</p>
                <p className="mt-1 text-[16px] font-semibold text-[#141b2b]">{title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[#464555]">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Two sides ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-14 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-[#e4e2ee] bg-white p-6">
          <p className="serial">If you have the idea</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#141b2b]">Strong on ideas, light on build?</h2>
          <ul className="mt-4 space-y-2.5 text-[14px] text-[#464555]">
            <li>• Find builders from any branch: software, electronics, mechanical, design.</li>
            <li>• Keep your approach private until you accept someone.</li>
            <li>• Pay only for milestones you accept, straight to the builder.</li>
            <li>• Stay under a handle if you don&apos;t want your name shown.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[#c9eedd] bg-[#f4fdf8] p-6">
          <p className="serial">If you can build</p>
          <h2 className="mt-2 font-serif text-[24px] font-semibold text-[#141b2b]">Earn from what you already know</h2>
          <ul className="mt-4 space-y-2.5 text-[14px] text-[#464555]">
            <li>• No bidding fees and no commission. You keep everything you are paid.</li>
            <li>• No reviews yet? Signed tasks and accepted milestones are your first credential.</li>
            <li>• List a service once, like “PCB review” or “fix your React bug”, and take requests.</li>
            <li>• Reviews stay hidden until both sides write theirs, so they stay honest.</li>
          </ul>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-12">
        <p className="text-[12px] leading-relaxed text-[#777587]">
          Attest is not affiliated with any university. It is for real projects, never graded coursework, exams or assignments. Paid work is for people 18 or older.
          Idea visibility controls who sees your details; it does not grant exclusive ownership.{" "}
          <Link href="/rules" className="font-semibold text-[#141b2b] underline underline-offset-2">House rules</Link> · <Link href="/pricing" className="font-semibold text-[#141b2b] underline underline-offset-2">Plans</Link> · <Link href="/privacy" className="font-semibold text-[#141b2b] underline underline-offset-2">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}

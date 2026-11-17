"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getHelp } from "@/lib/campus-api";

const PATH = [
  { n: "1", title: "Finish your profile", body: "Name, branch, interests, skills, and a two-week line. Cover and projects help owners decide faster.", href: "/profile", label: "Edit profile" },
  { n: "2", title: "Post an idea or report a problem", body: "Ideas seek teammates. Problems name a real pain for someone else to own. Different boards, different accents.", href: "/ideas/new", label: "Post idea", secondaryHref: "/problems/new", secondaryLabel: "Report a problem" },
  { n: "3", title: "Find people and apply", body: "People ranks other builders by skills and shared interests. Ask with a structured offer — skills, phases, hours — not a free dump of their secrets.", href: "/people", label: "Open People" },
  { n: "4", title: "Decide in Inbox", body: "Fit-ranked requests, day-7 check-ins, and signatures to approve all land in Inbox.", href: "/inbox", label: "Open inbox" },
  { n: "5", title: "Ship and get signed", body: "Workspace tasks → submit → owner signs. Signed lines land on your proof page.", href: "/proof", label: "Open proof" },
];

const FALLBACK = [
  { q: "What is the difference between Ideas and Problems?", a: "Ideas are builds looking for teammates (indigo). Problems are real pains — you propose an idea to own the fix (amber)." },
  { q: "What is public on an idea?", a: "Owners choose Minimal, Standard, or Open. Approach and contact stay gated unless Open makes approach readable. Full brief unlocks after accept on Minimal cards." },
  { q: "Can I fork an idea?", a: "Yes. Fork starts your own related idea with credit. It only copies the public slice — never private approach notes." },
  { q: "Are there DMs?", a: "No. Invite someone to an idea or send a structured offer. Decisions stay on Attest." },
];

export default function HelpPage() {
  const { token } = useAuth();
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>(FALLBACK);

  useEffect(() => {
    if (!token) {
      setAnswers(FALLBACK);
      return;
    }
    getHelp(token).then((data) => setAnswers(data.answers.length ? data.answers : FALLBACK)).catch(() => setAnswers(FALLBACK));
  }, [token]);

  return (
    <div className="px-5 py-6 max-w-2xl xl:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="font-serif text-[32px] font-semibold">Help</h1>
        <p className="text-[14px] text-[#464555] mt-1">Sprint rules and the happy path. This page cannot accept, remove, ship, or sign for you.</p>
      </div>

      <section className="grid sm:grid-cols-2 gap-3">
        <Link href="/ideas" className="rounded-xl border border-[#e4e2ee] bg-white p-4 hover:border-[#4f46e5]/40 transition-colors">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Ideas</p>
          <p className="font-serif text-[18px] font-semibold mt-1">Builds seeking teammates</p>
        </Link>
        <Link href="/problems" className="rounded-xl border border-[#f3e6d4] bg-[#fffbf5] p-4 hover:border-[#b45309]/40 transition-colors">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">Problems</p>
          <p className="font-serif text-[18px] font-semibold mt-1">Pains needing a builder</p>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#777587]">Happy path</h2>
        {PATH.map((step) => (
          <article key={step.n} className="bg-white rounded-xl p-4 flex gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <span className="w-7 h-7 rounded-full bg-[#eef2ff] text-[#3730a3] text-[12px] font-bold flex items-center justify-center shrink-0">{step.n}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-[15px]">{step.title}</h3>
              <p className="text-[13px] text-[#464555] mt-0.5">{step.body}</p>
              <div className="flex flex-wrap gap-3 mt-2">
                <Link href={step.href} className="text-[13px] font-semibold text-[#4f46e5]">{step.label} →</Link>
                {"secondaryHref" in step && step.secondaryHref && (
                  <Link href={step.secondaryHref} className="text-[13px] font-semibold text-[#b45309]">{step.secondaryLabel} →</Link>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#777587]">Rules FAQ</h2>
        {answers.map((item) => (
          <article key={item.q} className="bg-white rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="font-semibold text-[15px]">{item.q}</h3>
            <p className="text-[14px] text-[#464555] mt-1 leading-relaxed">{item.a}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GIG_CATEGORIES } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, listGigs, type Gig } from "@/lib/campus-api";
import CampusSwitch, { useCampusScope } from "@/components/campus/CampusSwitch";
import GigTicket from "@/components/campus/GigTicket";
import EmptyState from "@/components/campus/EmptyState";

type Tab = "request" | "offer" | "mine";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "request", label: "Needs doing", hint: "Small jobs people want done" },
  { id: "offer", label: "Services", hint: "What student builders offer" },
  { id: "mine", label: "My gigs", hint: "Gigs you posted" },
];

export default function GigsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("request");
  const [scope, setScope] = useCampusScope();
  const [category, setCategory] = useState("");
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/gigs");
  }, [isLoading, user, router]);

  const query = (next?: string | null) => ({
    kind: tab === "offer" ? ("offer" as const) : ("request" as const),
    campus: tab !== "mine" && scope === "campus",
    category: category || undefined,
    mine: tab === "mine",
    cursor: next,
  });

  useEffect(() => {
    if (!token) return;
    setGigs(null);
    setError(null);
    listGigs(token, query())
      .then((page) => { setGigs(page.gigs); setCursor(page.nextCursor); })
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load gigs"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab, scope, category]);

  const more = async () => {
    if (!token || !cursor) return;
    setBusy(true);
    try {
      const page = await listGigs(token, query(cursor));
      setGigs((list) => [...(list || []), ...page.gigs]);
      setCursor(page.nextCursor);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-6 max-w-5xl 2xl:max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="serial text-[#047857]">Gigs · quick work, one milestone</p>
          <h1 className="font-serif text-[36px] font-semibold tracking-tight text-[#141b2b]">
            Small jobs, <span className="hl-green">paid directly</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#464555]">
            Ask for something small, or list what you can do. Accepting a response starts a one-milestone deal. Builders pay no fee, and Attest never holds the money.
          </p>
        </div>
        <Link href="/kits" className="text-[13px] font-semibold text-[#047857] underline underline-offset-4">Running a fest or club? Use a Kit →</Link>
        <Link
          href="/gigs/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[3px_3px_0_0_#141b2b] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#141b2b]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>add</span>
          Post a gig
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Gig lists">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              title={item.hint}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === item.id ? "bg-[#047857] text-white" : "text-[#464555] hover:bg-[#ecfdf5]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "mine" && <CampusSwitch value={scope} onChange={setScope} />}
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="rounded-full border border-[#d8d5e6] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#464555]">
            <option value="">All categories</option>
            {GIG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {gigs === null && !error && <p className="text-[14px] text-[#777587]">Loading…</p>}
      {gigs && gigs.length === 0 && (
        <EmptyState
          title={tab === "mine" ? "You haven't posted a gig" : scope === "campus" ? "Nothing on your campus yet" : "No gigs here yet"}
          body={tab === "offer"
            ? "List one thing you can do well, like “PCB review” or “fix your React bug”. People request it and you accept the ones you want."
            : "Post a small job with a clear deliverable. Builders respond, you pick one, and it becomes a one-milestone deal."}
          actionHref="/gigs/new"
          actionLabel="Post a gig"
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(gigs || []).map((gig) => <GigTicket key={gig.id} gig={gig} />)}
      </div>
      {cursor && (
        <button type="button" onClick={more} disabled={busy} className="rounded-lg border border-[#c7c4d8] px-4 py-2 text-[13px]">
          {busy ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEAL_TYPE_LABELS, type DealType } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, listDeals, type DealSummary } from "@/lib/campus-api";
import EmptyState from "@/components/campus/EmptyState";

const STATUS_STYLE: Record<DealSummary["status"], string> = {
  proposed: "bg-[#fffbeb] text-[#92400e]",
  active: "bg-[#ecfdf5] text-[#047857]",
  completed: "bg-[#eef0ff] text-[#3730a3]",
  cancelled: "bg-[#f5f5f4] text-[#57534e]",
};

export default function DealsPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [deals, setDeals] = useState<DealSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/deals");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    listDeals(token)
      .then((page) => { setDeals(page.engagements); setCursor(page.nextCursor); })
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load deals"));
  }, [token]);

  const more = async () => {
    if (!token || !cursor) return;
    setBusy(true);
    try {
      const page = await listDeals(token, cursor);
      setDeals((list) => [...(list || []), ...page.engagements]);
      setCursor(page.nextCursor);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
      <p className="serial text-[#047857]">Deals · milestones and payments</p>
      <h1 className="font-serif text-[32px] font-semibold tracking-tight">Your deals</h1>
      <p className="text-[14px] text-[#464555] mt-1">
        Agreements between an idea owner and a builder, split into milestones. Attest never holds money: paid deals are paid directly, and both sides confirm each payment here.
      </p>
      {error && <p className="mt-4 text-[13px] text-[#ba1a1a]">{error}</p>}
      {deals === null && !error && <p className="mt-6 text-[14px] text-[#777587]">Loading…</p>}
      {deals && deals.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No deals yet"
            body="Owners propose a deal to a teammate from the team workspace. Builders: join a team first, then the owner can offer you paid or credit work."
            actionHref="/ideas"
            actionLabel="Browse ideas"
          />
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {(deals || []).map((deal) => (
          <li key={deal.id}>
            <Link href={`/deals/${deal.id}`} className="ticket card-lift block p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[15px] text-[#141b2b] truncate">{deal.ideaTitle}</p>
                  <p className="text-[12px] text-[#777587] mt-0.5">
                    {deal.role === "requester" ? "You're paying/crediting" : "You're building for"} @{deal.otherHandle} · {DEAL_TYPE_LABELS[deal.dealType as DealType] ?? deal.dealType}
                    {deal.isGig ? " · Gig" : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[deal.status]}`}>{deal.status}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px]">
                <span className="text-[#464555]"><span className="ledger font-semibold">{deal.milestonesDone}/{deal.milestonesTotal}</span> milestones done{deal.total ? <> · <span className="ledger font-semibold text-[#047857]">{deal.total}</span></> : null}</span>
                {deal.needsYou && <span className="font-semibold text-[#b45309]">Needs you</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {cursor && (
        <button type="button" onClick={more} disabled={busy} className="mt-4 px-4 py-2 rounded-lg border border-[#c7c4d8] text-[13px]">
          {busy ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

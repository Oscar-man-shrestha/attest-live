"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEAL_TYPE_LABELS, type DealType } from "@embedra/types";
import { getPersonRecord, type PersonRecord } from "@/lib/campus-api";

/** Score spread for one review dimension: a row of five bars, never an average (RULES 19). */
function Spread({ label, counts }: { label: string; counts: number[] }) {
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[12px] text-[#464555]">{label}</span>
      <div className="flex items-end gap-1 h-8" role="img" aria-label={`${label}: ${counts.map((c, i) => `${c} rated ${i + 1}`).join(", ")}`}>
        {counts.map((count, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div className="w-5 rounded-sm bg-[#4f46e5]" style={{ height: `${Math.max(2, (count / max) * 24)}px`, opacity: count ? 1 : 0.15 }} />
            <span className="text-[9px] text-[#777587]">{i + 1}</span>
          </div>
        ))}
      </div>
      <span className="text-[11px] text-[#777587]">{total} {total === 1 ? "review" : "reviews"}</span>
    </div>
  );
}

export default function DealRecord({ token, personId, self }: { token: string; personId: string; self: boolean }) {
  const [record, setRecord] = useState<PersonRecord | null>(null);

  useEffect(() => {
    getPersonRecord(token, personId).then(setRecord).catch(() => setRecord(null));
  }, [token, personId]);

  if (!record) return null;
  const { reviews, deals } = record;
  if (!deals.length && !reviews.count) {
    return self ? (
      <section className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="text-[15px] font-semibold text-[#141b2b]">Deal record</h2>
        <p className="mt-1 text-[13px] text-[#777587]">Accepted milestones and confirmed payments show here. Join a team and do a deal to start your record.</p>
      </section>
    ) : null;
  }

  return (
    <section className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[#141b2b]">Deal record</h2>
        <p className="text-[12px] text-[#777587]">Only milestones the other side accepted count. Paid amounts are confirmed by both payer and payee.</p>
      </div>
      {deals.length > 0 && (
        <ul className="space-y-2">
          {deals.map((deal) => (
            <li key={deal.id} className="flex items-start justify-between gap-3 text-[13px]">
              <div>
                <p className="font-medium text-[#141b2b]">{deal.title}</p>
                <p className="text-[12px] text-[#777587]">
                  {deal.role === "builder" ? "Built" : "Requested"} · {DEAL_TYPE_LABELS[deal.dealType as DealType] ?? deal.dealType} · {deal.milestonesDone} milestone{deal.milestonesDone === 1 ? "" : "s"} accepted
                </p>
              </div>
              {deal.paidConfirmed && <span className="shrink-0 rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">✓ {deal.paidConfirmed} paid</span>}
            </li>
          ))}
        </ul>
      )}
      {reviews.count > 0 && (
        <div className="space-y-2 border-t border-[#eceaf4] pt-3">
          <Spread label="On time" counts={reviews.onTime} />
          <Spread label="Communication" counts={reviews.communication} />
          <Spread label="Quality" counts={reviews.quality} />
          <p className="text-[12px] text-[#464555]">Would work together again: {reviews.wouldWorkAgain.yes} yes · {reviews.wouldWorkAgain.no} no</p>
        </div>
      )}
      {self && <Link href="/deals" className="inline-block text-[13px] font-semibold text-[#4f46e5]">Open your deals →</Link>}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEAL_TYPE_LABELS, isTipUrl, type DealType } from "@embedra/types";
import { getPersonRecord, type HelpEvent, type PersonRecord } from "@/lib/campus-api";
import Stamp from "@/components/brand/Stamp";

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

const EVENT: Record<string, { icon: string; text: string }> = {
  task_signed: { icon: "draw", text: "Task signed by a teammate" },
  milestone_accepted: { icon: "task_alt", text: "Work accepted" },
  milestone_paid: { icon: "verified", text: "Work accepted and thanked (confirmed by both)" },
  requested_done: { icon: "handshake", text: "Saw a request through to the end" },
  idea_shipped: { icon: "rocket_launch", text: "Shipped an idea" },
};

function HistoryRow({ event }: { event: HelpEvent }) {
  const meta = EVENT[event.kind] ?? { icon: "check", text: event.kind };
  const title = event.ideaId ? <Link href={`/ideas/${event.ideaId}`} className="font-medium text-[#141b2b] hover:underline">{event.title}</Link> : <span className="font-medium text-[#141b2b]">{event.title}</span>;
  return (
    <li className="flex gap-3">
      <span className="material-symbols-outlined mt-0.5 text-[18px] text-[#047857]" aria-hidden>{meta.icon}</span>
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="text-[#464555]">{meta.text}: {title}</p>
        {event.detail && <p className="text-[12px] text-[#777587] truncate">{event.detail}</p>}
      </div>
      <time className="serial shrink-0">{new Date(event.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" })}</time>
    </li>
  );
}

/** Trust record on a profile: what this person helped with, built only from things someone else confirmed. */
export default function DealRecord({ token, personId, self }: { token: string; personId: string; self: boolean }) {
  const [record, setRecord] = useState<PersonRecord | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getPersonRecord(token, personId).then(setRecord).catch(() => setRecord(null));
  }, [token, personId]);

  if (!record) return null;
  const { reviews, deals, trust, history = [], tipUrl } = record;
  const empty = !deals.length && !reviews.count && !history.length;
  const tiles: [string, number][] = trust
    ? [["People helped", trust.peopleHelped], ["Work accepted", trust.milestonesAccepted], ["Tasks signed", trust.tasksSigned], ["Seen through", trust.dealsCompleted]]
    : [];
  const shown = showAll ? history : history.slice(0, 6);
  const safeTip = tipUrl && isTipUrl(tipUrl) ? tipUrl : null;

  return (
    <section className="ticket" aria-labelledby="trust-heading">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="serial text-[#047857]">Trust record</p>
            <h2 id="trust-heading" className="font-serif text-[22px] font-semibold text-[#141b2b]">What {self ? "you have" : `@${record.handle ?? "they"} has`} helped with</h2>
            <p className="mt-0.5 text-[12px] text-[#777587]">Only things someone else confirmed count here. Nothing is self-reported.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {record.verifiedStudent && <Stamp flat tone="ink" icon="school">Verified student</Stamp>}
            {safeTip && !self && (
              <a href={safeTip} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-xl bg-[#f59e0b] px-3.5 py-2 text-[13px] font-semibold text-[#1c1917] shadow-[3px_3px_0_0_#141b2b] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#141b2b]">
                <span className="material-symbols-outlined text-[18px]" aria-hidden>local_cafe</span>
                Buy @{record.handle} a coffee
              </a>
            )}
            {self && !safeTip && <Link href="/profile" className="text-[12px] font-semibold text-[#b45309] underline underline-offset-2">Add a “Buy me a coffee” link</Link>}
          </div>
        </div>
        {tiles.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#eceaf4] bg-[#fbfbfe] px-3 py-2.5">
                <dd className="ledger text-[22px] font-bold text-[#141b2b]">{value}</dd>
                <dt className="text-[11px] text-[#777587]">{label}</dt>
              </div>
            ))}
          </dl>
        )}
        {trust && trust.dealsDropped > 0 && <p className="mt-2 text-[12px] text-[#92400e]">{trust.dealsDropped} accepted deal{trust.dealsDropped === 1 ? " was" : "s were"} cancelled before finishing.</p>}
        {safeTip && !self && <p className="mt-3 text-[11px] text-[#777587]">A coffee is a voluntary thank-you. It goes straight to them on their own tipping page; Attest never handles money.</p>}
      </div>

      {empty ? (
        <>
          <div className="ticket-tear" />
          <p className="p-5 text-[13px] text-[#777587]">
            {self ? "Nothing yet. Join a team or answer a gig; each accepted piece of work lands here with its date." : "No confirmed help yet."}
          </p>
        </>
      ) : (
        <>
          {history.length > 0 && (
            <>
              <div className="ticket-tear" />
              <div className="p-5">
                <h3 className="serial mb-3">Help history</h3>
                <ol className="space-y-3">{shown.map((event, i) => <HistoryRow key={`${event.kind}-${event.at}-${i}`} event={event} />)}</ol>
                {history.length > 6 && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-[12px] font-semibold text-[#4f46e5]">
                    {showAll ? "Show less" : `Show all ${history.length}`}
                  </button>
                )}
              </div>
            </>
          )}
          {deals.length > 0 && (
            <>
              <div className="ticket-tear" />
              <div className="p-5">
                <h3 className="serial mb-3">Deals</h3>
                <ul className="space-y-2">
                  {deals.map((deal) => (
                    <li key={deal.id} className="flex items-start justify-between gap-3 text-[13px]">
                      <div>
                        <p className="font-medium text-[#141b2b]">{deal.title}</p>
                        <p className="text-[12px] text-[#777587]">
                          {deal.role === "builder" ? "Built" : "Requested"} · {DEAL_TYPE_LABELS[deal.dealType as DealType] ?? deal.dealType} · {deal.milestonesDone} milestone{deal.milestonesDone === 1 ? "" : "s"} accepted
                        </p>
                      </div>
                      {deal.paidConfirmed && <Stamp flat icon="verified" className="shrink-0">{deal.paidConfirmed} paid</Stamp>}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          {reviews.count > 0 && (
            <>
              <div className="ticket-tear" />
              <div className="p-5 space-y-2">
                <h3 className="serial mb-1">Reviews</h3>
                <Spread label="On time" counts={reviews.onTime} />
                <Spread label="Communication" counts={reviews.communication} />
                <Spread label="Quality" counts={reviews.quality} />
                <p className="text-[12px] text-[#464555]">Would work together again: {reviews.wouldWorkAgain.yes} yes · {reviews.wouldWorkAgain.no} no</p>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

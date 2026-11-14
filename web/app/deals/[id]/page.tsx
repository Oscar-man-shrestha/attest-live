"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DEAL_TYPE_LABELS, PAYMENT_METHODS, type DealType } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import {
  CampusApiError,
  acceptDeal,
  acceptMilestone,
  cancelDeal,
  confirmMilestonePayment,
  disputeMilestone,
  getDeal,
  listDealMessages,
  postDealMessage,
  recordMilestonePayment,
  reviewDeal,
  submitMilestone,
  type Deal,
  type DealMessage,
  type DealMilestone,
} from "@/lib/campus-api";

const STATUS_LABEL: Record<DealMilestone["status"], string> = {
  open: "Not started",
  submitted: "Waiting for review",
  accepted: "Accepted",
  auto_accepted: "Accepted (auto)",
  disputed: "Changes requested",
  payment_confirmed: "Paid · confirmed by both",
};
const METHOD_LABEL: Record<string, string> = {
  upi: "UPI", bank_transfer: "Bank transfer", razorpay_link: "Razorpay link", payoneer: "Payoneer", wise: "Wise", paypal: "PayPal", cash: "Cash", other: "Other",
};

const input = "w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=/deals/${id}`);
  }, [isLoading, user, router, id]);

  const load = useCallback(() => {
    if (!token || !id) return;
    getDeal(token, id)
      .then((r) => setDeal(r.engagement))
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load the deal"));
  }, [token, id]);
  useEffect(load, [load]);

  const act = async (key: string, run: () => Promise<{ engagement: Deal }>) => {
    setBusy(key);
    setError(null);
    try {
      const r = await run();
      setDeal(r.engagement);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  if (!deal) return <p className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading…"}</p>;
  const other = deal.role === "requester" ? deal.builder : deal.requester;
  const isRequester = deal.role === "requester";
  const isBuilder = deal.role === "builder";

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl mx-auto space-y-5">
      <div>
        <Link href="/deals" className="text-[13px] text-[#4f46e5]">← All deals</Link>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#047857]">
          {DEAL_TYPE_LABELS[deal.dealType as DealType] ?? deal.dealType} · {deal.status}
        </p>
        <h1 className="font-serif text-[30px] font-semibold tracking-tight">{deal.idea?.title ?? "Deal"}</h1>
        <p className="text-[14px] text-[#464555] mt-1">
          {isRequester ? "Builder" : "Requester"}: <Link href={`/profile/${other?.id}`} className="font-semibold text-[#141b2b] hover:underline">@{other?.handle}</Link>
          {deal.total ? <> · Total <span className="font-semibold">{deal.total}</span></> : null}
          {deal.licence ? <> · {deal.licence}</> : null}
          {deal.nda ? <> · NDA</> : null}
        </p>
      </div>

      {deal.paymentNotice && (
        <p className="rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] p-3 text-[13px] text-[#065f46]">{deal.paymentNotice}</p>
      )}
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}

      {deal.status === "proposed" && (
        <section className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4 space-y-3">
          <p className="text-[14px] text-[#78350f]">
            {isBuilder ? "You've been offered this deal. Read the milestones and ownership terms, then accept or decline." : "Waiting for the builder to accept."}
          </p>
          <div className="flex flex-wrap gap-2">
            {isBuilder && (
              <button type="button" disabled={busy === "accept"} onClick={() => act("accept", () => acceptDeal(token!, deal.id))} className="px-4 py-2 rounded-lg bg-[#047857] text-white text-[13px] font-semibold">
                {busy === "accept" ? "Accepting…" : "Accept deal"}
              </button>
            )}
            <CancelButton busy={busy === "cancel"} label={isBuilder ? "Decline" : "Withdraw"} onCancel={(reason) => act("cancel", () => cancelDeal(token!, deal.id, reason))} />
          </div>
        </section>
      )}
      {deal.status === "cancelled" && (
        <p className="rounded-xl border border-[#e7e5e4] bg-[#fafaf9] p-3 text-[13px] text-[#57534e]">Cancelled{deal.cancelReason ? `: “${deal.cancelReason}”` : ""}. Accepted milestones stay on both records.</p>
      )}
      {deal.status === "completed" && (
        <p className="rounded-xl border border-[#c7d2fe] bg-[#eef0ff] p-3 text-[13px] text-[#3730a3]">Complete. Every milestone is done{deal.paid ? " and both of you confirmed each payment" : ""}, and it shows as proof on both profiles.</p>
      )}

      <section className="space-y-3" aria-labelledby="milestones-heading">
        <h2 id="milestones-heading" className="text-[13px] font-semibold uppercase tracking-wider text-[#777587]">Milestones</h2>
        {deal.milestones.map((m) => (
          <MilestoneCard key={m.id} m={m} deal={deal} busy={busy} act={act} token={token!} />
        ))}
      </section>

      <section className="rounded-2xl border border-[#eceaf4] bg-white p-4">
        <h2 className="text-[13px] font-semibold text-[#141b2b]">Ownership</h2>
        <p className="mt-1 text-[13px] text-[#464555] whitespace-pre-wrap">{deal.ipTerms}</p>
      </section>

      {deal.status === "active" && (
        <div className="flex justify-end">
          <CancelButton busy={busy === "cancel"} label="Cancel deal" onCancel={(reason) => act("cancel", () => cancelDeal(token!, deal.id, reason))} />
        </div>
      )}

      {(deal.status === "completed" || deal.reviews.mine || deal.reviews.theirs) && (
        <Reviews deal={deal} busy={busy === "review"} onSubmit={(r) => act("review", () => reviewDeal(token!, deal.id, r))} />
      )}

      {token && deal.role !== "admin" && <Thread token={token} dealId={deal.id} open={deal.threadOpen} />}
    </div>
  );
}

function MilestoneCard({ m, deal, busy, act, token }: {
  m: DealMilestone;
  deal: Deal;
  busy: string | null;
  act: (key: string, run: () => Promise<{ engagement: Deal }>) => Promise<void>;
  token: string;
}) {
  const [links, setLinks] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("upi");
  const [reference, setReference] = useState("");
  const [mode, setMode] = useState<null | "submit" | "dispute" | "pay">(null);
  const active = deal.status === "active";
  const isRequester = deal.role === "requester";
  const isBuilder = deal.role === "builder";
  const accepted = m.status === "accepted" || m.status === "auto_accepted";
  const done = m.status === "payment_confirmed" || (!deal.paid && accepted);
  const key = (k: string) => `${k}:${m.id}`;

  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${done ? "border-[#bbf7d0] bg-[#f0fdf4]" : "border-[#e4e2ee] bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[15px] text-[#141b2b]">{m.position}. {m.title}</p>
          <p className="text-[12px] text-[#777587]">
            {STATUS_LABEL[m.status]}
            {m.amount ? ` · ${m.amount}` : ""}
            {m.dueAt ? ` · due ${date(m.dueAt)}` : ""}
            {m.status === "submitted" && m.acceptanceDeadline ? ` · auto-accepts ${date(m.acceptanceDeadline)}` : ""}
          </p>
        </div>
        {done && <span className="material-symbols-outlined text-[#15803d]" aria-label="Done">verified</span>}
      </div>

      {m.deliverableLinks.length > 0 && (
        <ul className="text-[13px] space-y-0.5">
          {m.deliverableLinks.map((link) => (
            <li key={link}><a href={link} target="_blank" rel="noopener noreferrer" className="text-[#4f46e5] break-all hover:underline">{link}</a></li>
          ))}
        </ul>
      )}
      {m.note && <p className="text-[13px] text-[#464555]">“{m.note}”</p>}
      {m.status === "disputed" && m.disputeReason && <p className="text-[13px] text-[#92400e]">Changes requested: “{m.disputeReason}”</p>}
      {m.payment?.payerConfirmedAt && (
        <p className="text-[12px] text-[#065f46]">
          Paid by {METHOD_LABEL[m.payment.method] ?? m.payment.method}{m.payment.reference ? ` (ref ${m.payment.reference})` : ""} on {date(m.payment.payerConfirmedAt)}
          {m.payment.payeeConfirmedAt ? ` · received ${date(m.payment.payeeConfirmedAt)}` : " · waiting for the builder to confirm receipt"}
        </p>
      )}

      {active && (
        <div className="flex flex-wrap gap-2 pt-1">
          {isBuilder && (m.status === "open" || m.status === "disputed") && mode !== "submit" && (
            <button type="button" onClick={() => setMode("submit")} className="px-3 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[12px] font-semibold">Submit work</button>
          )}
          {isRequester && m.status === "submitted" && (
            <>
              <button type="button" disabled={busy === key("accept")} onClick={() => act(key("accept"), () => acceptMilestone(token, m.id))} className="px-3 py-1.5 rounded-lg bg-[#047857] text-white text-[12px] font-semibold">Accept</button>
              {mode !== "dispute" && <button type="button" onClick={() => setMode("dispute")} className="px-3 py-1.5 rounded-lg border border-[#c7c4d8] text-[12px] font-semibold">Request changes</button>}
            </>
          )}
          {isRequester && deal.paid && accepted && !m.payment?.payerConfirmedAt && mode !== "pay" && (
            <button type="button" onClick={() => setMode("pay")} className="px-3 py-1.5 rounded-lg bg-[#047857] text-white text-[12px] font-semibold">I&apos;ve paid this</button>
          )}
          {isBuilder && deal.paid && m.payment?.payerConfirmedAt && !m.payment.payeeConfirmedAt && (
            <button type="button" disabled={busy === key("confirm")} onClick={() => act(key("confirm"), () => confirmMilestonePayment(token, m.id))} className="px-3 py-1.5 rounded-lg bg-[#047857] text-white text-[12px] font-semibold">I received the payment</button>
          )}
        </div>
      )}

      {mode === "submit" && (
        <div className="space-y-2 pt-1">
          <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} placeholder="Links to the work, one per line (repo, demo, video, CAD file…)" className={input} />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Short note (optional)" className={input} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy === key("submit")}
              onClick={() => act(key("submit"), () => submitMilestone(token, m.id, links.split(/\s+/).map((l) => l.trim()).filter(Boolean), note.trim() || undefined)).then(() => setMode(null))}
              className="px-3 py-1.5 rounded-lg bg-[#4f46e5] text-white text-[12px] font-semibold"
            >
              Submit for review
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-[12px] text-[#777587]">Cancel</button>
          </div>
          <p className="text-[11px] text-[#777587]">The requester has 7 days to accept or ask for changes. After that it&apos;s accepted automatically.</p>
        </div>
      )}
      {mode === "dispute" && (
        <div className="space-y-2 pt-1">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="What needs to change? Be specific." className={input} />
          <div className="flex gap-2">
            <button type="button" disabled={reason.trim().length < 8} onClick={() => act(key("dispute"), () => disputeMilestone(token, m.id, reason.trim())).then(() => setMode(null))} className="px-3 py-1.5 rounded-lg bg-[#b45309] text-white text-[12px] font-semibold disabled:opacity-50">Send</button>
            <button type="button" onClick={() => setMode(null)} className="text-[12px] text-[#777587]">Cancel</button>
          </div>
        </div>
      )}
      {mode === "pay" && (
        <div className="space-y-2 pt-1">
          <div className="grid sm:grid-cols-2 gap-2">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={input} aria-label="Payment method">
              {PAYMENT_METHODS.map((pm) => <option key={pm} value={pm}>{METHOD_LABEL[pm]}</option>)}
            </select>
            <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} placeholder="Transaction / receipt ID (optional)" className={input} />
          </div>
          <p className="text-[11px] text-[#777587]">Never enter an account, card or UPI number — only the receipt ID.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy === key("pay")} onClick={() => act(key("pay"), () => recordMilestonePayment(token, m.id, method, reference.trim())).then(() => setMode(null))} className="px-3 py-1.5 rounded-lg bg-[#047857] text-white text-[12px] font-semibold">Record payment</button>
            <button type="button" onClick={() => setMode(null)} className="text-[12px] text-[#777587]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CancelButton({ busy, label, onCancel }: { busy: boolean; label: string; onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg border border-[#c7c4d8] text-[13px] text-[#57534e]">{label}</button>;
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} placeholder="Reason (they'll see this)" className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px]" />
      <button type="button" disabled={busy || reason.trim().length < 4} onClick={() => onCancel(reason.trim())} className="px-3 py-2 rounded-lg bg-[#b91c1c] text-white text-[13px] font-semibold disabled:opacity-50">{label}</button>
      <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-[#777587]">Keep</button>
    </div>
  );
}

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="flex items-center justify-between gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="text-[13px] text-[#464555]">{label}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} aria-label={`${label}: ${n} of 5`} onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-lg text-[13px] font-semibold border ${value === n ? "bg-[#141b2b] text-white border-[#141b2b]" : "border-[#c7c4d8] text-[#464555]"}`}>{n}</button>
        ))}
      </span>
    </fieldset>
  );
}

function Reviews({ deal, busy, onSubmit }: { deal: Deal; busy: boolean; onSubmit: (r: { onTime: number; communication: number; quality: number; wouldWorkAgain: boolean; note?: string }) => void }) {
  const [onTime, setOnTime] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [quality, setQuality] = useState(0);
  const [again, setAgain] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const show = (r: NonNullable<Deal["reviews"]["mine"]>) => (
    <p className="text-[13px] text-[#464555]">On time {r.onTime}/5 · Communication {r.communication}/5 · Quality {r.quality}/5 · {r.wouldWorkAgain ? "Would work again" : "Would not work again"}{r.note ? ` — “${r.note}”` : ""}</p>
  );
  return (
    <section className="rounded-2xl border border-[#eceaf4] bg-white p-4 space-y-3">
      <h2 className="text-[13px] font-semibold text-[#141b2b]">Reviews</h2>
      <p className="text-[12px] text-[#777587]">Reviews stay hidden until you both submit, or 14 days pass. Profiles show how scores are spread, never an average.</p>
      {deal.reviews.canReview && (
        <div className="space-y-2">
          <Scale label="On time" value={onTime} onChange={setOnTime} />
          <Scale label="Communication" value={communication} onChange={setCommunication} />
          <Scale label="Quality" value={quality} onChange={setQuality} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-[#464555]">Would you work together again?</span>
            <span className="flex gap-1">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" aria-pressed={again === v} onClick={() => setAgain(v)} className={`px-3 h-8 rounded-lg text-[13px] font-semibold border ${again === v ? "bg-[#141b2b] text-white border-[#141b2b]" : "border-[#c7c4d8] text-[#464555]"}`}>{v ? "Yes" : "No"}</button>
              ))}
            </span>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="One line (optional, shown with the review)" className={input} />
          <button type="button" disabled={busy || !onTime || !communication || !quality || again === null}
            onClick={() => onSubmit({ onTime, communication, quality, wouldWorkAgain: Boolean(again), note: note.trim() || undefined })}
            className="px-3 py-1.5 rounded-lg bg-[#141b2b] text-white text-[12px] font-semibold disabled:opacity-40">Submit review</button>
        </div>
      )}
      {deal.reviews.mine && <div><p className="text-[12px] font-semibold text-[#777587]">Your review</p>{show(deal.reviews.mine)}</div>}
      {deal.reviews.waitingOnOther && <p className="text-[13px] text-[#777587]">Waiting for the other review.</p>}
      {deal.reviews.theirs && <div><p className="text-[12px] font-semibold text-[#777587]">Their review of you</p>{show(deal.reviews.theirs)}</div>}
    </section>
  );
}

function Thread({ token, dealId, open }: { token: string; dealId: string; open: boolean }) {
  const [messages, setMessages] = useState<DealMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listDealMessages(token, dealId)
      .then((page) => { setMessages(page.messages); setCursor(page.nextCursor); })
      .catch(() => undefined);
  }, [token, dealId]);
  useEffect(() => {
    refresh();
    if (!open) return;
    const timer = setInterval(refresh, 20_000);
    return () => clearInterval(timer);
  }, [refresh, open]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    try {
      const r = await postDealMessage(token, dealId, body.trim());
      setMessages((list) => [r.message, ...list]);
      setWarning(r.warning);
      setBody("");
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not send");
    }
  };

  const older = async () => {
    if (!cursor) return;
    const page = await listDealMessages(token, dealId, cursor);
    setMessages((list) => [...list, ...page.messages]);
    setCursor(page.nextCursor);
  };

  return (
    <section className="rounded-2xl border border-[#eceaf4] bg-white p-4 space-y-3" aria-labelledby="thread-heading">
      <h2 id="thread-heading" className="text-[13px] font-semibold text-[#141b2b]">Deal thread</h2>
      <p className="text-[12px] text-[#777587]">Only the two of you can see this. It&apos;s archived when the deal closes. Keep payment details in the payment step.</p>
      {open && (
        <form onSubmit={send} className="flex gap-2">
          <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Write a message" className={input} aria-label="Message" />
          <button type="submit" className="px-3 py-2 rounded-lg bg-[#141b2b] text-white text-[13px] font-semibold">Send</button>
        </form>
      )}
      {warning && <p className="text-[12px] text-[#92400e]">{warning}</p>}
      {error && <p className="text-[12px] text-[#ba1a1a]">{error}</p>}
      <ul className="space-y-2">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] ${m.mine ? "ml-auto bg-[#eef0ff] text-[#1e1b4b]" : "bg-[#f5f5f4] text-[#1c1917]"}`}>
            <p className="text-[11px] font-semibold opacity-70">@{m.handle} · {new Date(m.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            {m.flag && <p className="mt-1 text-[11px] text-[#92400e]">Contains contact or payment details — be careful.</p>}
          </li>
        ))}
      </ul>
      {messages.length === 0 && <p className="text-[13px] text-[#777587]">No messages yet.</p>}
      {cursor && <button type="button" onClick={older} className="text-[12px] text-[#4f46e5]">Older messages</button>}
    </section>
  );
}

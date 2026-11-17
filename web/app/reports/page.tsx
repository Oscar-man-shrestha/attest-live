"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BILLING_ENABLED } from "@embedra/types";
import {
  listReports,
  resolveReport,
  listIntegrityFlags,
  resolveIntegrityFlag,
  unsuspendPerson,
  getBillingQueue,
  approveSubscription,
  cancelSubscription,
  type BillingRequest,
  CampusApiError,
  type IntegrityFlag,
  type SuspensionAppeal,
} from "@/lib/campus-api";
import EmptyState from "@/components/campus/EmptyState";

type ReportRow = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  targetTitle?: string | null;
  createdAt?: string;
};

export default function ReportsPage() {
  const { token, user } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    if (!token || !user?.isAdmin) return;
    listReports(token)
      .then((data) => setRows(data.reports as ReportRow[]))
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load reports"));
  };
  useEffect(() => {
    if (user?.isAdmin) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.isAdmin]);

  const act = async (id: string, action: "restore" | "keep") => {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await resolveReport(token, id, action);
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not resolve report");
    } finally {
      setBusyId(null);
    }
  };

  const hrefFor = (row: ReportRow) =>
    row.targetType === "problem" ? `/problems/${row.targetId}` : `/ideas/${row.targetId}`;

  return (
    <div className="px-5 py-6 max-w-2xl xl:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="font-serif text-[32px] font-semibold text-[#16161d]">Reports</h1>
        <p className="mt-1 text-[14px] text-[#464555] leading-relaxed">
          An admin does not read every idea before it is posted. This queue is reports only.
        </p>
      </div>
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {!user?.isAdmin && (
        <p className="text-[14px] text-[#777587]">
          You can file a report from a card. Only an admin resolves the queue.
        </p>
      )}
      {!error && rows.length === 0 && (
        <EmptyState
          title={user?.isAdmin ? "Queue is clear" : "No reports in the queue"}
          body={user?.isAdmin
            ? "When a student reports spam or copied work, the card hides here until you restore it or leave it hidden."
            : "If a card looks like spam or copied work, use Report on that idea. An admin reviews the queue."}
          actionHref={!user?.isAdmin ? "/ideas" : undefined}
          actionLabel={!user?.isAdmin ? "Browse ideas" : undefined}
        />
      )}
      {rows.map((row) => (
        <article
          key={row.id}
          className="bg-white rounded-xl p-4 space-y-3 border border-[#e4e1ec] shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
                {row.targetType}
              </span>
              {row.targetTitle && (
                <span className="text-[14px] font-semibold text-[#16161d]">{row.targetTitle}</span>
              )}
            </div>
            {row.createdAt && (
              <time className="text-[12px] text-[#777587]">{new Date(row.createdAt).toLocaleString()}</time>
            )}
          </div>
          <p className="text-[13px] text-[#464555] bg-[#faf9fc] rounded-lg p-2.5 border border-[#eeeef4] leading-relaxed">
            <strong className="text-[#16161d] font-medium">Reason:</strong> {row.reason}
          </p>
          <div>
            <Link href={hrefFor(row)} className="text-[13px] font-medium text-[#4f46e5] hover:underline inline-flex items-center gap-1">
              View {row.targetType} details &rarr;
            </Link>
          </div>
          {token && user?.isAdmin && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => act(row.id, "restore")}
                className="h-9 px-4 rounded-lg bg-[#4f46e5] text-white text-[13px] font-medium disabled:opacity-50"
              >
                Restore
              </button>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => act(row.id, "keep")}
                className="h-9 px-4 rounded-lg border border-[#c7c5d0] text-[13px] font-medium text-[#464555] disabled:opacity-50"
              >
                Leave hidden
              </button>
            </div>
          )}
        </article>
      ))}
      {BILLING_ENABLED && token && user?.isAdmin && <BillingQueue token={token} />}
      {token && user?.isAdmin && <IntegrityQueue token={token} />}
    </div>
  );
}

/** Coursework flags (keyword or model) and suspension appeals. Flags never act on their own; an admin decides. */
function IntegrityQueue({ token }: { token: string }) {
  const [flags, setFlags] = useState<IntegrityFlag[]>([]);
  const [appeals, setAppeals] = useState<SuspensionAppeal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    listIntegrityFlags(token)
      .then((data) => { setFlags(data.flags); setAppeals(data.appeals); })
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load flags"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [token]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  const hrefFor = (flag: IntegrityFlag) =>
    flag.targetType === "problem" ? `/problems/${flag.targetId}` : flag.targetType === "idea" ? `/ideas/${flag.targetId}` : `/deals/${flag.targetId}`;

  return (
    <section className="pt-6 space-y-3" aria-labelledby="integrity-heading">
      <div>
        <h2 id="integrity-heading" className="font-serif text-[24px] font-semibold text-[#16161d]">Coursework flags</h2>
        <p className="text-[13px] text-[#464555]">
          Posts that read like graded coursework. Confirming hides the post (or cancels the deal). It never suspends anyone — do that separately if it&apos;s deliberate.
        </p>
      </div>
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {flags.length === 0 && <p className="text-[13px] text-[#777587]">No flags waiting.</p>}
      {flags.map((flag) => (
        <article key={flag.id} className="bg-white rounded-xl p-4 space-y-2 border border-[#fde68a]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[14px] font-semibold text-[#16161d]">{flag.title || `${flag.targetType} ${flag.targetId.slice(0, 8)}`}</span>
            <span className="text-[11px] text-[#777587]">
              {flag.targetType} · {flag.source === "model" ? `model ${flag.score?.toFixed(2)}` : "keyword"} · {new Date(flag.createdAt).toLocaleDateString()}
            </span>
          </div>
          {flag.matched && <p className="text-[13px] text-[#464555] bg-[#fffbeb] rounded-lg p-2">“{flag.matched}”</p>}
          <div className="flex flex-wrap gap-2 items-center">
            <Link href={hrefFor(flag)} className="text-[13px] font-medium text-[#4f46e5] hover:underline">Open</Link>
            <button type="button" disabled={busy === flag.id} onClick={() => run(flag.id, () => resolveIntegrityFlag(token, flag.id, "clear"))} className="h-8 px-3 rounded-lg border border-[#c7c5d0] text-[12px] font-medium">Not coursework</button>
            <button type="button" disabled={busy === flag.id} onClick={() => run(flag.id, () => resolveIntegrityFlag(token, flag.id, "confirm"))} className="h-8 px-3 rounded-lg bg-[#b45309] text-white text-[12px] font-medium">Coursework — hide it</button>
          </div>
        </article>
      ))}

      <h2 className="font-serif text-[24px] font-semibold text-[#16161d] pt-4">Suspension appeals</h2>
      {appeals.length === 0 && <p className="text-[13px] text-[#777587]">No appeals waiting.</p>}
      {appeals.map((a) => (
        <article key={a.id} className="bg-white rounded-xl p-4 space-y-2 border border-[#fecaca]">
          <p className="text-[14px] font-semibold text-[#16161d]">@{a.username}</p>
          {a.suspendedReason && <p className="text-[12px] text-[#777587]">Suspended for: {a.suspendedReason}</p>}
          <p className="text-[13px] text-[#464555] whitespace-pre-wrap">{a.suspensionAppeal}</p>
          <button type="button" disabled={busy === a.id} onClick={() => run(a.id, () => unsuspendPerson(token, a.id))} className="h-8 px-3 rounded-lg bg-[#4f46e5] text-white text-[12px] font-medium">Lift suspension</button>
        </article>
      ))}
    </section>
  );
}

/** Plan requests from workspace owners. Billing is manual: arrange payment and an invoice, then activate. */
function BillingQueue({ token }: { token: string }) {
  const [rows, setRows] = useState<BillingRequest[]>([]);
  const [months, setMonths] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    getBillingQueue(token).then((r) => setRows(r.requests)).catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load billing"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [token]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try { await action(); load(); } catch (err) { setError(err instanceof CampusApiError ? err.message : "That didn't work"); } finally { setBusy(null); }
  };

  return (
    <section className="space-y-3" aria-labelledby="billing-heading">
      <div>
        <h2 id="billing-heading" className="font-serif text-[24px] font-semibold text-[#16161d]">Billing</h2>
        <p className="text-[13px] text-[#464555]">Plan requests from workspace owners. Email them to arrange payment and an invoice outside Attest, then activate the plan here.</p>
      </div>
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {rows.length === 0 && <p className="text-[13px] text-[#777587]">No plan requests.</p>}
      {rows.map((r) => (
        <article key={r.id} className={`bg-white rounded-xl p-4 space-y-2 border ${r.status === "requested" ? "border-[#9bd9bd]" : "border-[#e4e1ec]"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[14px] font-semibold text-[#16161d]">{r.workspace.name} · <span className="capitalize">{r.plan}</span></span>
            <span className="text-[11px] text-[#777587]">{r.status}{r.periodEnd ? ` until ${new Date(r.periodEnd).toLocaleDateString()}` : ""} · {new Date(r.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-[13px] text-[#464555]">
            @{r.requestedBy.handle} · <a href={`mailto:${r.requestedBy.email}?subject=${encodeURIComponent(`Attest ${r.plan} plan for ${r.workspace.name}`)}`} className="font-semibold text-[#4f46e5] underline">{r.requestedBy.email}</a>
            {r.amount ? <> · list price <span className="font-semibold">{r.amount}</span></> : null}
          </p>
          {r.note && <p className="text-[13px] text-[#464555] bg-[#faf9fc] rounded-lg p-2">“{r.note}”</p>}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[12px] text-[#464555]">Months
              <input type="number" min={1} max={24} value={months[r.id] ?? 1} onChange={(e) => setMonths((m) => ({ ...m, [r.id]: Number(e.target.value) || 1 }))} className="ml-1 w-16 rounded border border-[#c7c4d8] px-2 py-1 text-[13px]" />
            </label>
            <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => approveSubscription(token, r.id, months[r.id] ?? 1))} className="h-8 px-3 rounded-lg bg-[#047857] text-white text-[12px] font-medium">
              {r.status === "active" ? "Extend" : "Payment received — activate"}
            </button>
            <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => cancelSubscription(token, r.id))} className="h-8 px-3 rounded-lg border border-[#c7c5d0] text-[12px] font-medium">
              {r.status === "active" ? "End plan" : "Decline"}
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

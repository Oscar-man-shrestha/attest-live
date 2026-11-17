"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BILLING_ENABLED, PLANS, formatMoney } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, addWorkspaceMember, getWorkspace, removeWorkspaceMember, requestUpgrade, type WorkspaceDetail } from "@/lib/campus-api";
import PlanMeter from "@/components/campus/PlanMeter";
import Stamp from "@/components/brand/Stamp";

const date = (v: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<WorkspaceDetail | null>(null);
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=/workspaces/${id}`);
  }, [isLoading, user, router, id]);

  const load = useCallback(() => {
    if (!token || !id) return;
    getWorkspace(token, id).then(setData).catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load the workspace"));
  }, [token, id]);
  useEffect(load, [load]);

  const run = async (key: string, action: () => Promise<WorkspaceDetail | { left: true }>, done?: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if ("left" in result) return router.push("/workspaces");
      setData(result);
      if (done) setNotice(done);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <p className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading…"}</p>;
  const owner = data.role === "owner";
  const { plan, usage } = data;
  const pro = PLANS.pro;

  return (
    <div className="px-5 sm:px-8 py-6 max-w-4xl xl:max-w-6xl mx-auto space-y-5">
      <Link href="/workspaces" className="text-[13px] text-[#047857]">← Workspaces</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="serial text-[#047857]">Workspace · {owner ? "you own this" : "you're a member"}</p>
          <h1 className="font-serif text-[34px] font-semibold tracking-tight text-[#141b2b]">{data.workspace.name}</h1>
        </div>
        <Link href={`/kits?workspace=${data.workspace.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>add</span>
          Start a kit here
        </Link>
      </div>

      {error && <p className="text-[13px] text-[#ba1a1a]" role="alert">{error}</p>}
      {notice && <p className="text-[13px] text-[#047857]">{notice}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Plan */}
        <section className="ticket" aria-labelledby="plan-heading">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="serial">Current plan</p>
                <h2 id="plan-heading" className="font-serif text-[26px] font-semibold text-[#141b2b]">{plan.name}</h2>
                <p className="text-[13px] text-[#777587]">{!BILLING_ENABLED ? "Free while Attest is new" : plan.id === "free" ? "Free forever" : `Active until ${date(plan.periodEnd)}`}</p>
              </div>
              {plan.badge && <Stamp icon="verified" thunk>Verified organiser</Stamp>}
            </div>
            <div className="mt-4 space-y-3">
              <PlanMeter label="Members" used={usage.members} limit={plan.limits.members} />
              <PlanMeter label="Open kits" used={usage.openKits} limit={plan.limits.openKits} />
              <p className="text-[12px] text-[#777587]">Up to {plan.limits.needsPerKit} needs per kit{plan.csvExport ? " · CSV export" : ""}.</p>
            </div>
          </div>
          {!BILLING_ENABLED && (
            <>
              <div className="ticket-tear" />
              <div className="p-5">
                <p className="flex items-center gap-2 font-semibold text-[#141b2b]">
                  Pro
                  <span className="rounded-full border border-dashed border-[#a8a5bd] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#777587]">Coming soon</span>
                </p>
                <p className="mt-1 text-[13px] text-[#464555]">Paid plans for bigger teams are on the way. Everything here is free until then, and we&apos;ll tell you well before anything changes.</p>
              </div>
            </>
          )}
          {BILLING_ENABLED && owner && plan.id === "free" && (
            <>
              <div className="ticket-tear" />
              <div className="p-5 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-[#141b2b]">Pro · <span className="ledger">{formatMoney(pro.priceMinor, pro.currency)}</span> <span className="text-[13px] font-normal text-[#777587]">{pro.period}</span></p>
                  <Link href="/pricing" className="text-[12px] font-semibold text-[#4f46e5]">Compare plans</Link>
                </div>
                <ul className="text-[13px] text-[#464555] space-y-1">
                  <li>• {pro.members} members, {pro.openKits} open kits, {pro.needsPerKit} needs per kit</li>
                  <li>• CSV export of every kit</li>
                  <li>• “Verified organiser” stamp on your kits, so builders trust your requests</li>
                </ul>
                {data.pendingUpgrade ? (
                  <p className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 text-[13px] text-[#78350f]">Upgrade requested. We&apos;ll email you to arrange payment and an invoice, then switch your plan on.</p>
                ) : (
                  <>
                    <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Anything we should know? (optional, e.g. event dates)" className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]" />
                    <button type="button" disabled={busy === "upgrade"} onClick={() => run("upgrade", () => requestUpgrade(token!, data.workspace.id, "pro", note.trim()), "Request sent")} className="rounded-xl bg-[#141b2b] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[3px_3px_0_0_#047857]">
                      {busy === "upgrade" ? "Sending…" : "Request Pro"}
                    </button>
                    <p className="text-[11px] text-[#777587]">No card needed. We contact you to arrange payment, then activate the plan. Need more than Pro? <button type="button" className="font-semibold underline" onClick={() => run("upgrade", () => requestUpgrade(token!, data.workspace.id, "campus", note.trim()), "Request sent")}>Ask about Campus</button>.</p>
                  </>
                )}
              </div>
            </>
          )}
        </section>

        {/* Team */}
        <section className="ticket" aria-labelledby="team-heading">
          <div className="p-5">
            <h2 id="team-heading" className="font-serif text-[20px] font-semibold text-[#141b2b]">Team</h2>
            <ul className="mt-3 space-y-2">
              {data.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 text-[13px]">
                  <span>
                    <Link href={`/profile/${m.userId}`} className="font-semibold text-[#141b2b] hover:underline">@{m.handle}</Link>
                    {m.displayName ? <span className="text-[#777587]"> · {m.displayName}</span> : null}
                    {m.role === "owner" && <span className="ml-1 rounded bg-[#141b2b] px-1.5 py-0.5 text-[10px] font-semibold text-white">Owner</span>}
                  </span>
                  {m.role !== "owner" && (owner || m.userId === user?.id) && (
                    <button type="button" disabled={busy === m.userId} onClick={() => run(m.userId, () => removeWorkspaceMember(token!, data.workspace.id, m.userId), m.userId === user?.id ? undefined : "Removed")} className="text-[12px] text-[#777587] hover:text-[#ba1a1a]">
                      {m.userId === user?.id ? "Leave" : "Remove"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {owner && (
            <>
              <div className="ticket-tear" />
              <form className="p-5 space-y-2" onSubmit={(e) => { e.preventDefault(); if (handle.trim()) run("add", () => addWorkspaceMember(token!, data.workspace.id, handle.trim().replace(/^@/, "")), "Added").then(() => setHandle("")); }}>
                <label className="block text-[12px] font-medium text-[#464555]">Add someone by their Attest handle
                  <div className="mt-1 flex gap-2">
                    <span className="inline-flex items-center rounded-lg border border-[#e4e2ee] bg-[#f7f7fb] px-2 text-[14px] text-[#777587]">@</span>
                    <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={25} placeholder="rivet_4821" className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]" />
                    <button type="submit" disabled={busy === "add"} className="rounded-lg border border-[#047857] px-3 py-2 text-[13px] font-semibold text-[#047857]">Add</button>
                  </div>
                </label>
                <p className="text-[11px] text-[#777587]">Members can start kits and add needs here. Only you manage the team and the plan.</p>
              </form>
            </>
          )}
        </section>
      </div>

      <section className="ticket p-5" aria-labelledby="kits-heading">
        <h2 id="kits-heading" className="font-serif text-[20px] font-semibold text-[#141b2b]">Kits</h2>
        {data.kits.length === 0 ? (
          <p className="mt-2 text-[13px] text-[#777587]">No kits yet. Start one for your next event.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.kits.map((k) => (
              <li key={k.id}>
                <Link href={`/kits/${k.id}`} className="flex items-center justify-between rounded-xl border border-[#eceaf4] px-3 py-2 text-[13px] hover:border-[#9bd9bd]">
                  <span className="font-semibold text-[#141b2b]">{k.name}</span>
                  <span className={`serial ${k.status === "open" ? "text-[#047857]" : ""}`}>{k.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {BILLING_ENABLED && owner && data.billing.length > 0 && (
        <section className="ticket p-5" aria-labelledby="billing-heading">
          <h2 id="billing-heading" className="font-serif text-[20px] font-semibold text-[#141b2b]">Billing history</h2>
          <ul className="mt-3 space-y-2 text-[13px]">
            {data.billing.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                <span><span className="font-semibold capitalize text-[#141b2b]">{b.plan}</span> · {b.status}{b.periodEnd ? ` · until ${date(b.periodEnd)}` : ""}</span>
                <span className="ledger text-[#464555]">{b.amount ?? ""} · {date(b.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

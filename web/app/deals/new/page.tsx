"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, createDeal, getWork, type WorkScreen } from "@/lib/campus-api";
import { CURRENCIES, DEAL_TYPE_LABELS, DEAL_TYPES, DEFAULT_IP_TERMS, LICENCES, isPaidDeal, type DealType } from "@embedra/types";

type Step = { title: string; amount: string; dueAt: string };

const input = "mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";

function NewDealForm() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const ideaId = params.get("ideaId") || "";
  const builderId = params.get("builderId") || "";
  const [work, setWork] = useState<WorkScreen | null>(null);
  const [dealType, setDealType] = useState<DealType>("credit_only");
  const [currency, setCurrency] = useState("INR");
  const [licence, setLicence] = useState("MIT");
  const [steps, setSteps] = useState<Step[]>([{ title: "", amount: "", dueAt: "" }]);
  const [ipTerms, setIpTerms] = useState(DEFAULT_IP_TERMS);
  const [nda, setNda] = useState(false);
  const [attest, setAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(`/deals/new?ideaId=${ideaId}&builderId=${builderId}`)}`);
  }, [isLoading, user, router, ideaId, builderId]);

  useEffect(() => {
    if (!token || !ideaId) return;
    getWork(token, ideaId)
      .then((screen) => {
        setWork(screen);
        const type = (screen.idea.dealType as DealType) || "credit_only";
        setDealType(type);
        if (screen.idea.currency) setCurrency(screen.idea.currency);
        if (screen.idea.licence) setLicence(screen.idea.licence);
        if (isPaidDeal(type) && screen.idea.budgetMinor) {
          setSteps([{ title: "", amount: String(screen.idea.budgetMinor / 100), dueAt: "" }]);
        }
      })
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load the idea"));
  }, [token, ideaId]);

  const builder = work?.roster.find((m) => m.userId === builderId && !m.leftAt);
  const paid = isPaidDeal(dealType);
  const total = steps.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const setStep = (index: number, patch: Partial<Step>) => setSteps((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !work) return;
    if (!attest) return setError("Confirm this is not graded coursework, an exam, or an assignment");
    if (steps.some((s) => s.title.trim().length < 3)) return setError("Every milestone needs a title (at least 3 characters)");
    if (paid && steps.some((s) => !(Number(s.amount) > 0))) return setError("Every paid milestone needs an amount");
    setBusy(true);
    setError(null);
    try {
      const result = await createDeal(token, {
        ideaId,
        builderId,
        dealType,
        currency: paid ? currency : null,
        licence: dealType === "open_source" ? licence : null,
        ipTerms: ipTerms.trim(),
        nda,
        milestones: steps.map((s) => ({
          title: s.title.trim(),
          amount: paid ? Number(s.amount) : 0,
          dueAt: s.dueAt ? new Date(`${s.dueAt}T23:59:00`).toISOString() : null,
        })),
        notAcademicWork: true,
      });
      router.push(`/deals/${result.engagement.id}`);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not propose the deal");
    } finally {
      setBusy(false);
    }
  };

  if (!ideaId || !builderId) {
    return <p className="px-5 py-10 text-[14px] text-[#464555]">Open a team workspace and pick a teammate to propose a deal.</p>;
  }
  if (!work) {
    return <p className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading…"}</p>;
  }
  if (!work.isAuthor) {
    return <p className="px-5 py-10 text-[14px] text-[#464555]">Only the idea owner can propose a deal.</p>;
  }
  if (!builder) {
    return <p className="px-5 py-10 text-[14px] text-[#464555]">That person isn&apos;t on this team. Accept their request first.</p>;
  }

  return (
    <div className="px-5 sm:px-8 py-6 max-w-2xl mx-auto">
      <Link href={`/ideas/${ideaId}/work`} className="text-[13px] text-[#4f46e5]">← Back to the team</Link>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#047857]">New deal</p>
      <h1 className="font-serif text-[30px] font-semibold tracking-tight">Propose a deal with {builder.name}</h1>
      <p className="text-[14px] text-[#464555] mt-1">For “{work.idea.title}”. They see these terms and accept or decline. Small milestones work best — each one is reviewed, and paid deals are paid one milestone at a time.</p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#eceaf4]">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">Deal type</p>
          <select value={dealType} onChange={(e) => setDealType(e.target.value as DealType)} className={input}>
            {DEAL_TYPES.map((type) => <option key={type} value={type}>{DEAL_TYPE_LABELS[type]}</option>)}
          </select>
          {paid && (
            <>
              <label className="block text-[12px] font-medium text-[#464555]">Currency
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={input}>
                  {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
                </select>
              </label>
              {(!user?.isAdult || !builder) && (
                <p className="text-[12px] text-[#92400e]">Paid deals need both of you to have confirmed you are 18 or older (Profile → Account).</p>
              )}
            </>
          )}
          {dealType === "open_source" && (
            <label className="block text-[12px] font-medium text-[#464555]">Licence
              <select value={licence} onChange={(e) => setLicence(e.target.value)} className={input}>
                {LICENCES.map((code) => <option key={code}>{code}</option>)}
              </select>
            </label>
          )}
        </section>

        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#eceaf4]">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">Milestones ({steps.length}/8)</p>
            {paid && <p className="text-[13px] font-semibold text-[#047857]">Total {currency} {total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>}
          </div>
          {steps.map((step, index) => (
            <div key={index} className="rounded-xl border border-[#e4e2ee] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#464555]">Milestone {index + 1}</span>
                {steps.length > 1 && (
                  <button type="button" onClick={() => setSteps((list) => list.filter((_, i) => i !== index))} className="text-[12px] text-[#777587] hover:text-[#ba1a1a]">Remove</button>
                )}
              </div>
              <input value={step.title} onChange={(e) => setStep(index, { title: e.target.value })} maxLength={140} placeholder="What will be delivered, e.g. “Sensor node sends readings every minute”" className={input} aria-label={`Milestone ${index + 1} title`} />
              <div className="grid grid-cols-2 gap-2">
                {paid && (
                  <label className="block text-[12px] font-medium text-[#464555]">Amount ({currency})
                    <input type="number" min="1" step="any" inputMode="decimal" value={step.amount} onChange={(e) => setStep(index, { amount: e.target.value })} className={input} />
                  </label>
                )}
                <label className="block text-[12px] font-medium text-[#464555]">Due (optional)
                  <input type="date" value={step.dueAt} onChange={(e) => setStep(index, { dueAt: e.target.value })} className={input} />
                </label>
              </div>
            </div>
          ))}
          {steps.length < 8 && (
            <button type="button" onClick={() => setSteps((list) => [...list, { title: "", amount: "", dueAt: "" }])} className="px-3 py-2 rounded-lg border border-[#c7c4d8] text-[13px] font-semibold">
              Add milestone
            </button>
          )}
        </section>

        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#eceaf4]">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">Ownership</p>
          <textarea value={ipTerms} onChange={(e) => setIpTerms(e.target.value)} rows={3} maxLength={2000} className={input} aria-label="IP terms" />
          <label className="flex items-center gap-2 text-[13px] text-[#464555]">
            <input type="checkbox" checked={nda} onChange={(e) => setNda(e.target.checked)} />
            The builder can&apos;t show this work in their portfolio (NDA)
          </label>
          <p className="text-[12px] text-[#777587]">These defaults are not legal advice. For co-owned deals or larger amounts, put the agreement in writing outside Attest too.</p>
        </section>

        <section className="rounded-2xl p-4 border border-[#e4e2ee] bg-[#fafafa]">
          <label className="flex items-start gap-2 text-[13px] text-[#1b1b24]">
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1" />
            <span>
              This is not graded coursework, an exam, or an assignment.
              {paid && <span className="block text-[12px] text-[#777587]">You&apos;ll pay the builder directly. Attest never holds money and builders pay no fee.</span>}
            </span>
          </label>
        </section>

        {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
        <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-lg bg-[#047857] text-white text-[13px] font-semibold disabled:opacity-60">
          {busy ? "Sending…" : "Send deal to builder"}
        </button>
      </form>
    </div>
  );
}

export default function NewDealPage() {
  return (
    <Suspense fallback={<p className="px-5 py-10 text-[14px] text-[#777587]">Loading…</p>}>
      <NewDealForm />
    </Suspense>
  );
}

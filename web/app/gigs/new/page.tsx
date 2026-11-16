"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CURRENCIES, GIG_CATEGORIES, detectAcademicRequest } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, confirmAdult, createGig } from "@/lib/campus-api";

const input = "mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";

export default function NewGigPage() {
  const { user, token, isLoading, setCurrentUser } = useAuth();
  const router = useRouter();
  const [kind, setKind] = useState<"request" | "offer">("request");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(GIG_CATEGORIES[0]);
  const [paid, setPaid] = useState(true);
  const [currency, setCurrency] = useState("INR");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");
  const [campusOnly, setCampusOnly] = useState(false);
  const [attest, setAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/gigs/new");
  }, [isLoading, user, router]);
  if (!user) return null;

  const request = kind === "request";
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (title.trim().length < 6) return setError("Give the gig a clear title (at least 6 characters)");
    if (description.trim().length < 30) return setError("Describe the deliverable in a sentence or two (at least 30 characters)");
    if (paid && !(Number(price) > 0)) return setError("Add a price");
    if (!attest) return setError("Confirm this is not graded coursework, an exam, or an assignment");
    setBusy(true);
    setError(null);
    try {
      const result = await createGig(token, {
        kind,
        title: title.trim(),
        description: description.trim(),
        category,
        dealType: paid ? "paid_fixed" : "credit_only",
        currency: paid ? currency : null,
        price: paid ? Number(price) : null,
        deliveryDays: days ? Number(days) : null,
        campusOnly,
        notAcademicWork: true,
      });
      router.push(`/gigs/${result.gig.id}`);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not post the gig");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-6 max-w-2xl xl:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto">
      <Link href="/gigs" className="text-[13px] text-[#047857]">← Gigs</Link>
      <p className="serial mt-3 text-[#047857]">New gig</p>
      <h1 className="font-serif text-[32px] font-semibold tracking-tight">Post a gig</h1>
      <p className="mt-1 text-[14px] text-[#464555]">One small job with one clear deliverable. You&apos;re shown by your handle (@{user.handle || user.username}), not your name.</p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <fieldset className="grid sm:grid-cols-2 gap-2">
          <legend className="sr-only">Kind of gig</legend>
          {([
            ["request", "I need this done", "You'll pay or credit whoever does it."],
            ["offer", "I can do this", "A service listing. People request it; you pick which to accept."],
          ] as const).map(([value, label, help]) => (
            <label key={value} className={`flex items-start gap-2 rounded-xl border bg-white px-3 py-2.5 text-[13px] cursor-pointer ${kind === value ? "border-[#047857] bg-[#f4fdf8]" : "border-[#e4e2ee]"}`}>
              <input type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)} className="mt-1" />
              <span>
                <span className="font-semibold text-[#141b2b]">{label}</span>
                <span className="block text-[12px] text-[#777587]">{help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <section className="ticket">
          <div className="p-5 space-y-3">
            <label className="block text-[12px] font-medium text-[#464555]">Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder={request ? "Solder a 12-pin header onto a sensor board" : "KiCad schematic review in 48 hours"} className={input} />
            </label>
            <label className="block text-[12px] font-medium text-[#464555]">{request ? "What exactly should be delivered?" : "What will you deliver?"}
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1500} className={input} />
              <span className="mt-1 block text-[11px] font-normal text-[#777587]">{description.trim().length}/30 minimum</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-medium text-[#464555]">Category
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                  {GIG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-[#464555]">Delivery in days <span className="font-normal text-[#777587]">(optional)</span>
                <input type="number" min="1" max="60" value={days} onChange={(e) => setDays(e.target.value)} className={input} />
              </label>
            </div>
          </div>
          <div className="ticket-tear" />
          <div className="p-5 space-y-3">
            <div className="flex gap-2">
              {([[true, "Paid, fixed price"], [false, "Credit + proof only"]] as const).map(([value, label]) => (
                <button key={label} type="button" aria-pressed={paid === value} onClick={() => setPaid(value)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold border ${paid === value ? "bg-[#047857] text-white border-[#047857]" : "border-[#c7c4d8] text-[#464555]"}`}>
                  {label}
                </button>
              ))}
            </div>
            {paid && (
              <>
                <div className="flex gap-2">
                  <label className="block text-[12px] font-medium text-[#464555]">Currency
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${input} ledger`}>
                      {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
                    </select>
                  </label>
                  <label className="block flex-1 text-[12px] font-medium text-[#464555]">{request ? "You pay" : "Your price"}
                    <input type="number" min="1" step="any" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="300" className={`${input} ledger`} />
                  </label>
                </div>
                <p className="text-[12px] text-[#777587]">Paid directly between the two of you (UPI, bank, Payoneer…) after the work is accepted. Both confirm it here.</p>
                {!user.isAdult && (
                  <p className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 text-[12px] text-[#78350f]">
                    Paid gigs need both sides to be 18 or older.{" "}
                    <button type="button" className="font-semibold underline" onClick={async () => {
                      if (!token) return;
                      try { await confirmAdult(token); setCurrentUser({ ...user, isAdult: true }); }
                      catch (err) { setError(err instanceof CampusApiError ? err.message : "Could not save"); }
                    }}>I confirm I am 18 or older</button>
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        {user.hasCampus !== false && <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={campusOnly} onChange={(e) => setCampusOnly(e.target.checked)} className="mt-1" />
          <span>Only my campus can see this.
            <span className="block text-[12px] text-[#777587]">Best for anything handed over in person, like hardware.</span>
          </span>
        </label>}
        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1" />
          <span>This is not graded coursework, an exam, or an assignment.</span>
        </label>
        {detectAcademicRequest(`${title}\n${description}`) && (
          <p className="text-[12px] text-[#92400e]">This reads like coursework. If it is, please don&apos;t post it here — posts like this are reviewed by a moderator.</p>
        )}
        {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">
          {busy ? "Posting…" : "Post gig"}
        </button>
      </form>
    </div>
  );
}

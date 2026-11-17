"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CURRENCIES, GIG_CATEGORIES, KIT_KIND_LABELS } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, addKitNeed, closeKit, downloadKitCsv, getKit, type KitDetail, type KitNeed } from "@/lib/campus-api";
import CampusChips from "@/components/campus/CampusChips";
import Stamp from "@/components/brand/Stamp";

const input = "mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";
const STAGES: KitNeed["stage"][] = ["open", "hired", "review", "delivered", "paid"];
const STAGE_LABEL: Record<KitNeed["stage"], string> = {
  open: "Open", hired: "Hired", review: "To review", delivered: "Delivered", paid: "Paid", closed: "Closed", cancelled: "Cancelled",
};

/** Five-step progress rail for one need. */
function Rail({ stage }: { stage: KitNeed["stage"] }) {
  const at = STAGES.indexOf(stage);
  if (at < 0) return <span className="serial">{STAGE_LABEL[stage]}</span>;
  return (
    <ol className="flex items-center gap-1" aria-label={`Stage: ${STAGE_LABEL[stage]}`}>
      {STAGES.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${i <= at ? "bg-[#047857]" : "bg-[#d8d5e6]"}`} />
          <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${i === at ? "text-[#047857]" : "text-[#a3a1b3]"} ${i === at ? "" : "hidden sm:inline"}`}>{STAGE_LABEL[s]}</span>
          {i < STAGES.length - 1 && <span className={`h-px w-3 sm:w-5 ${i < at ? "bg-[#047857]" : "bg-[#d8d5e6]"}`} />}
        </li>
      ))}
    </ol>
  );
}

export default function KitPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<KitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(GIG_CATEGORIES[0]);
  const [paid, setPaid] = useState(true);
  const [currency, setCurrency] = useState("INR");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("");

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=/kits/${id}`);
  }, [isLoading, user, router, id]);

  const load = useCallback(() => {
    if (!token || !id) return;
    getKit(token, id).then(setData).catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load the kit"));
  }, [token, id]);
  useEffect(load, [load]);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (title.trim().length < 6) return setError("Give the need a clear title");
    if (description.trim().length < 30) return setError("Describe what should be delivered (at least 30 characters)");
    if (paid && !(Number(price) > 0)) return setError("Add a price, or switch to credit only");
    setBusy(true);
    setError(null);
    try {
      const next = await addKitNeed(token, id, {
        title: title.trim(), description: description.trim(), category,
        dealType: paid ? "paid_fixed" : "credit_only", currency: paid ? currency : null, price: paid ? Number(price) : null,
        deliveryDays: days ? Number(days) : null,
      });
      setData(next);
      setTitle(""); setDescription(""); setPrice(""); setDays("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not add the need");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading…"}</p>;
  const { kit, needs, totals } = data;
  const open = kit.status === "open";

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto space-y-5">
      <Link href="/kits" className="text-[13px] text-[#047857]">← Kits</Link>

      <header className="ticket">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="serial text-[#047857]">{KIT_KIND_LABELS[kit.kind as keyof typeof KIT_KIND_LABELS] ?? kit.kind} kit</span>
            {kit.eventDate && <span className="serial">Event · {new Date(kit.eventDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>}
          </div>
          <h1 className="mt-2 font-serif text-[30px] font-semibold leading-tight tracking-tight text-[#141b2b]">{kit.name}</h1>
          {kit.description && <p className="mt-2 text-[14px] text-[#464555]">{kit.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] text-[#777587]">Organised by {kit.workspace ? <span className="font-semibold text-[#141b2b]">{kit.workspace.name}</span> : <>@{kit.owner.handle}</>}</span>
            {kit.workspace?.verified && <Stamp flat icon="verified">Verified organiser</Stamp>}
            <CampusChips sameCampus={kit.sameCampus} campusOnly={kit.campusOnly} />
            {!open && <span className="rounded-full bg-[#f5f5f4] px-2 py-0.5 text-[11px] font-semibold text-[#57534e]">Closed</span>}
          </div>
        </div>
        <div className="ticket-tear" />
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
          {([["Needs", totals.needs], ["Open", totals.open], ["In progress", totals.inProgress], ["Done", totals.done]] as const).map(([label, value]) => (
            <div key={label}>
              <dt className="serial">{label}</dt>
              <dd className="ledger text-[24px] font-bold text-[#141b2b]">{value}</dd>
            </div>
          ))}
          {kit.mine && totals.budget && (
            <div className="col-span-2">
              <dt className="serial">Budget listed</dt>
              <dd className="ledger text-[18px] font-bold text-[#141b2b]">{totals.budget}</dd>
            </div>
          )}
          {kit.mine && totals.paidConfirmed && (
            <div className="col-span-2">
              <dt className="serial">Paid · confirmed by both</dt>
              <dd className="ledger text-[18px] font-bold text-[#047857]">{totals.paidConfirmed}</dd>
            </div>
          )}
        </dl>
      </header>

      {error && <p className="text-[13px] text-[#ba1a1a]" role="alert">{error}</p>}

      {kit.mine && open && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>{adding ? "close" : "add"}</span>
            {adding ? "Cancel" : "Add a need"}
          </button>
          <div className="flex items-center gap-3">
            {data.limits?.csvExport ? (
              <button type="button" onClick={async () => { if (!token) return; try { await downloadKitCsv(token, kit.id); } catch (err) { setError(err instanceof CampusApiError ? err.message : "Export failed"); } }} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#047857]">
                <span className="material-symbols-outlined text-[16px]" aria-hidden>download</span>Export CSV
              </button>
            ) : kit.workspace ? (
              <Link href={`/workspaces/${kit.workspace.id}`} className="text-[12px] font-semibold text-[#4f46e5]">CSV export is on Pro</Link>
            ) : null}
            <button type="button" onClick={async () => { if (!token) return; await closeKit(token, kit.id); load(); }} className="text-[12px] text-[#777587] hover:text-[#ba1a1a]">
              Close this kit
            </button>
          </div>
        </div>
      )}

      {adding && (
        <form onSubmit={add} className="rounded-2xl border border-[#c9eedd] bg-[#f4fdf8] p-5 space-y-3">
          <label className="block text-[12px] font-medium text-[#464555]">What do you need?
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Main stage poster, A2" className={input} />
          </label>
          <label className="block text-[12px] font-medium text-[#464555]">What exactly should be delivered?
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1500} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#464555]">Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {GIG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-[#464555]">Needed in days <span className="font-normal text-[#777587]">(optional)</span>
              <input type="number" min="1" max="60" value={days} onChange={(e) => setDays(e.target.value)} className={input} />
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {([[true, "Paid"], [false, "Credit + proof"]] as const).map(([value, label]) => (
              <button key={label} type="button" aria-pressed={paid === value} onClick={() => setPaid(value)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold border ${paid === value ? "bg-[#047857] text-white border-[#047857]" : "bg-white border-[#c7c4d8] text-[#464555]"}`}>{label}</button>
            ))}
            {paid && (
              <>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Currency" className="ledger rounded-lg border border-[#c7c4d8] px-2 py-2 text-[14px]">
                  {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
                </select>
                <input type="number" min="1" step="any" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1500" aria-label="Price" className="ledger w-32 rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]" />
              </>
            )}
          </div>
          <p className="text-[12px] text-[#777587]">You pay the builder directly after you accept the work. Attest never holds money and takes no cut.</p>
          <button type="submit" disabled={busy} className="rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "Adding…" : "Add to kit"}</button>
        </form>
      )}

      <section className="space-y-3" aria-labelledby="needs-heading">
        <h2 id="needs-heading" className="text-[13px] font-semibold uppercase tracking-wider text-[#777587]">Need list</h2>
        {needs.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#c7c4d8] bg-white p-5 text-[14px] text-[#777587]">
            {kit.mine ? "Nothing listed yet. Add your first need: a poster, reels, photography, merch, a stage backdrop, a website." : "The organiser hasn't listed any needs yet."}
          </p>
        )}
        {needs.map((need) => (
          <div key={need.id} className="ticket p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="serial">{need.category}</p>
                <Link href={`/gigs/${need.id}`} className="font-serif text-[18px] font-semibold text-[#141b2b] hover:underline">{need.title}</Link>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`ledger text-[16px] font-bold ${need.paid ? "text-[#047857]" : "text-[#464555]"}`}>{need.price ?? "Credit"}</span>
                {need.stage === "paid" && <Stamp flat icon="verified">Paid ✓✓</Stamp>}
              </div>
            </div>
            <Rail stage={need.stage} />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="text-[#777587]">
                {need.builderHandle ? <>Builder: <span className="font-semibold text-[#141b2b]">@{need.builderHandle}</span></> : need.stage === "open" ? "Waiting for builders" : ""}
                {need.managedBy && kit.workspace ? <span className="ml-2 text-[#a3a1b3]">· added by @{need.managedBy}</span> : null}
              </span>
              {kit.mine ? (
                need.engagementId ? <Link href={`/deals/${need.engagementId}`} className="font-semibold text-[#047857]">Open the deal →</Link>
                  : (need.responseCount ?? 0) > 0 ? <Link href={`/gigs/${need.id}`} className="font-semibold text-[#b45309]">{need.responseCount} new response{need.responseCount === 1 ? "" : "s"} →</Link>
                  : <Link href={`/gigs/${need.id}`} className="font-semibold text-[#4f46e5]">View →</Link>
              ) : need.stage === "open" ? <Link href={`/gigs/${need.id}`} className="font-semibold text-[#047857]">I can do this →</Link> : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

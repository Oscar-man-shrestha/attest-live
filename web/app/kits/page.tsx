"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KIT_KINDS, KIT_KIND_LABELS } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, createKit, listKits, listWorkspaces, type Kit, type WorkspaceSummary } from "@/lib/campus-api";
import { useSearchParams } from "next/navigation";
import CampusSwitch, { useCampusScope } from "@/components/campus/CampusSwitch";
import CampusChips from "@/components/campus/CampusChips";
import EmptyState from "@/components/campus/EmptyState";

const input = "mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";

function KitsPageInner() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [scope, setScope] = useCampusScope();
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("fest");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [campusOnly, setCampusOnly] = useState(true);
  const [attest, setAttest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [myWorkspaces, setMyWorkspaces] = useState<WorkspaceSummary[]>([]);
  const params = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string>(params.get("workspace") || "");

  useEffect(() => {
    if (!token) return;
    listWorkspaces(token).then((r) => setMyWorkspaces(r.workspaces)).catch(() => undefined);
  }, [token]);
  useEffect(() => {
    if (params.get("workspace")) setCreating(true);
  }, [params]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/kits");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    setKits(null);
    listKits(token, { campus: tab === "all" && scope === "campus", mine: tab === "mine" })
      .then((page) => setKits(page.kits))
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load kits"));
  }, [token, tab, scope]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (name.trim().length < 4) return setError("Give the kit a name, like “TechFest 2027 creative”");
    if (!attest) return setError("Confirm this is not graded coursework");
    setBusy(true);
    setError(null);
    try {
      const result = await createKit(token, {
        workspaceId: workspaceId || null,
        name: name.trim(), kind, description: description.trim() || undefined,
        eventDate: eventDate ? new Date(`${eventDate}T09:00:00`).toISOString() : null,
        campusOnly, notAcademicWork: true,
      });
      router.push(`/kits/${result.kit.id}`);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not create the kit");
      setBusy(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-6 max-w-5xl 2xl:max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="serial text-[#047857]">Kits · for fests, clubs and local businesses</p>
          <h1 className="font-serif text-[36px] font-semibold tracking-tight text-[#141b2b]">
            One list for <span className="hl-green">everything you need made</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#464555]">
            Poster, reels, photos, merch, a website. List each need once; student builders respond, and you track every one from open to paid on a single page. Free for organisers during the pilot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[3px_3px_0_0_#141b2b] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#141b2b]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>{creating ? "close" : "add"}</span>
          {creating ? "Cancel" : "Start a kit"}
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="ticket p-5 space-y-3 max-w-2xl">
          {myWorkspaces.length > 0 && (
            <label className="block text-[12px] font-medium text-[#464555]">Run it from
              <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className={input}>
                <option value="">Just me (personal kit)</option>
                {myWorkspaces.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.plan.name}</option>)}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-[#777587]">A workspace kit is shared with your whole team.</span>
            </label>
          )}
          <label className="block text-[12px] font-medium text-[#464555]">Kit name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="TechFest 2027 — creative and merch" className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#464555]">For
              <select value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
                {KIT_KINDS.map((k) => <option key={k} value={k}>{KIT_KIND_LABELS[k]}</option>)}
              </select>
            </label>
            <label className="block text-[12px] font-medium text-[#464555]">Event date <span className="font-normal text-[#777587]">(optional)</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={input} />
            </label>
          </div>
          <label className="block text-[12px] font-medium text-[#464555]">One line about it <span className="font-normal text-[#777587]">(optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} className={input} />
          </label>
          {user?.hasCampus !== false && <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={campusOnly} onChange={(e) => setCampusOnly(e.target.checked)} className="mt-1" />
            <span>Only my campus can see this kit and its needs.</span>
          </label>}
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1" />
            <span>Nothing in this kit is graded coursework, an exam, or an assignment.</span>
          </label>
          <button type="submit" disabled={busy} className="rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create kit and add needs"}</button>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(["all", "mine"] as const).map((id) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${tab === id ? "bg-[#047857] text-white" : "text-[#464555] hover:bg-[#ecfdf5]"}`}>
              {id === "all" ? "Open kits" : "My kits"}
            </button>
          ))}
        </div>
        {tab === "all" && <CampusSwitch value={scope} onChange={setScope} />}
      </div>

      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {kits === null && !error && <p className="text-[14px] text-[#777587]">Loading…</p>}
      {kits && kits.length === 0 && (
        <EmptyState
          title={tab === "mine" ? "You haven't started a kit" : "No open kits yet"}
          body="Organising a fest, a club event or anything that needs posters, video, photos or merch? Start a kit and list what you need."
          onAction={() => setCreating(true)}
          actionLabel="Start a kit"
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(kits || []).map((kit) => (
          <Link key={kit.id} href={`/kits/${kit.id}`} className="ticket card-lift block">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="serial text-[#047857]">{KIT_KIND_LABELS[kit.kind as keyof typeof KIT_KIND_LABELS] ?? kit.kind} kit</span>
                {kit.eventDate && <span className="serial">{new Date(kit.eventDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
              </div>
              <p className="mt-1.5 font-serif text-[20px] font-semibold leading-snug text-[#141b2b]">{kit.name}</p>
              {kit.description && <p className="mt-1 text-[13px] text-[#464555] line-clamp-2">{kit.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-[#777587]">@{kit.owner.handle}</span>
                <CampusChips sameCampus={kit.sameCampus} campusOnly={kit.campusOnly} />
                {kit.status === "closed" && <span className="rounded-full bg-[#f5f5f4] px-2 py-0.5 text-[11px] font-semibold text-[#57534e]">Closed</span>}
              </div>
            </div>
            <div className="ticket-tear" />
            <div className="flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="text-[#464555]"><span className="ledger font-bold text-[#141b2b]">{kit.needs - kit.filled}</span> open of <span className="ledger">{kit.needs}</span> needs</span>
              <span className="font-semibold text-[#047857]">{kit.mine ? "Manage →" : "See needs →"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function KitsPage() {
  return (
    <Suspense fallback={<p className="px-5 py-10 text-[14px] text-[#777587]">Loading…</p>}>
      <KitsPageInner />
    </Suspense>
  );
}

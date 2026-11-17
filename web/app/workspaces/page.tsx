"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KIT_KINDS, KIT_KIND_LABELS } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, createWorkspace, listWorkspaces, type WorkspaceSummary } from "@/lib/campus-api";
import Stamp from "@/components/brand/Stamp";
import EmptyState from "@/components/campus/EmptyState";

const input = "mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";

export default function WorkspacesPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<WorkspaceSummary[] | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("fest");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/workspaces");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    listWorkspaces(token).then((r) => setList(r.workspaces)).catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load workspaces"));
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (name.trim().length < 3) return setError("Give the workspace a name, like “TechFest 2027 core team”");
    setBusy(true);
    setError(null);
    try {
      const ws = await createWorkspace(token, name.trim(), kind);
      router.push(`/workspaces/${ws.workspace.id}`);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not create the workspace");
      setBusy(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-6 max-w-4xl xl:max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="serial text-[#047857]">Workspaces · for organiser teams</p>
          <h1 className="font-serif text-[36px] font-semibold tracking-tight text-[#141b2b]">
            Run your fest or club <span className="hl-green">as a team</span>
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#464555]">
            A workspace lets your core team share Kits, see every need and who&apos;s building it, and grow with a plan when you need more room. Students never pay.
          </p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[3px_3px_0_0_#141b2b] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#141b2b]">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>{creating ? "close" : "add"}</span>
          {creating ? "Cancel" : "New workspace"}
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="ticket p-5 space-y-3 max-w-xl">
          <label className="block text-[12px] font-medium text-[#464555]">Workspace name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="TechFest 2027 core team" className={input} />
          </label>
          <label className="block text-[12px] font-medium text-[#464555]">For
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
              {KIT_KINDS.map((k) => <option key={k} value={k}>{KIT_KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy} className="rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">{busy ? "Creating…" : "Create workspace (Free)"}</button>
        </form>
      )}

      {error && <p className="text-[13px] text-[#ba1a1a]" role="alert">{error}</p>}
      {list === null && !error && <p className="text-[14px] text-[#777587]">Loading…</p>}
      {list && list.length === 0 && (
        <EmptyState title="No workspaces yet" body="Create one for your fest, club or business, add your core team by handle, and run Kits together." onAction={() => setCreating(true)} actionLabel="New workspace" />
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(list || []).map((ws) => (
          <Link key={ws.id} href={`/workspaces/${ws.id}`} className="ticket card-lift block">
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="serial text-[#047857]">{KIT_KIND_LABELS[ws.kind as keyof typeof KIT_KIND_LABELS] ?? ws.kind}</span>
                {ws.plan.badge ? <Stamp flat icon="verified">{ws.plan.name}</Stamp> : <span className="serial">{ws.plan.name}</span>}
              </div>
              <p className="mt-1.5 font-serif text-[20px] font-semibold text-[#141b2b]">{ws.name}</p>
            </div>
            <div className="ticket-tear" />
            <div className="flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="text-[#464555]"><span className="ledger font-bold text-[#141b2b]">{ws.members}</span> / {ws.plan.limits.members} members</span>
              <span className="font-semibold text-[#047857]">{ws.role === "owner" ? "Manage →" : "Open →"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createSprintProblem, draftText, CampusApiError } from "@/lib/campus-api";
import EmptyState from "@/components/campus/EmptyState";
import { detectAcademicRequest, isAcademicEmail } from "@embedra/types";

export default function NewProblemPage() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", whatHappens: "", whoFeels: "", fixWouldChange: "", source: "lived", hideName: false, approach: "", contactEmail: "", notAcademicWork: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!user?.email) return;
    setForm((prev) => (prev.contactEmail.trim() ? prev : { ...prev, contactEmail: user.email }));
  }, [user?.email]);

  if (!isLoading && user && user.profileComplete === false) {
    return (
      <div className="px-5 py-10 max-w-lg mx-auto">
        <EmptyState
          title="Finish your profile first"
          body="Name, branch, and interests — then you can report a campus problem."
          actionHref="/profile"
          actionLabel="Open profile steps"
        />
      </div>
    );
  }

  return (
    <div className="px-5 py-6 max-w-2xl mx-auto">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">Real pains</p>
      <h1 className="font-serif text-[32px] font-semibold">Report a problem</h1>
      <p className="text-[14px] text-[#464555] mt-1">Name a real pain in concrete terms — on campus, in a club, a local business, anywhere. Someone else can propose an idea and own the build. You get source credit without being added to the build team. Deeper notes stay hidden until you accept.</p>
      <form
        className="mt-5 bg-white rounded-xl p-5 space-y-3 border border-[#f3e6d4]/80 shadow-[0_1px_2px_rgba(180,83,9,0.06)]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!token) return;
          const contactEmail = (form.contactEmail.trim() || user?.email || "").trim().toLowerCase();
          if (!isAcademicEmail(contactEmail)) {
            setError("Contact email must be a university address");
            return;
          }
          if (!form.notAcademicWork) {
            setError("Confirm this is not graded coursework, an exam, or an assignment");
            return;
          }
          setBusy(true);
          setError(null);
          try {
            const result = await createSprintProblem(token, {
              title: form.title.trim(),
              whatHappens: form.whatHappens.trim(),
              whoFeels: form.whoFeels.trim(),
              fixWouldChange: form.fixWouldChange.trim(),
              source: form.source,
              hideName: form.hideName,
              approach: form.approach.trim(),
              contactEmail,
              notAcademicWork: true,
            });
            router.push(`/problems/${result.problem.id}`);
          } catch (err) {
            setError(err instanceof CampusApiError ? err.message : "Could not post");
          } finally {
            setBusy(false);
          }
        }}
      >
        {(["title", "whatHappens", "whoFeels", "fixWouldChange"] as const).map((key) => (
          <label key={key} className="block text-[12px] font-medium capitalize text-[#464555]">
            {key === "whatHappens" ? "What is happening" : key === "whoFeels" ? "Who feels it" : key === "fixWouldChange" ? "What a fix would change" : "Title"}
            {key === "title" ? (
              <input value={form[key]} onChange={(e) => set(key, e.target.value)} className="mt-1 w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#b45309]/25" />
            ) : (
              <textarea value={form[key]} onChange={(e) => set(key, e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#b45309]/25" />
            )}
          </label>
        ))}
        <label className="block text-[12px] font-medium text-[#464555]">Lived or heard
          <select value={form.source} onChange={(e) => set("source", e.target.value)} className="mt-1 w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]">
            <option value="lived">I live with it</option>
            <option value="heard">I heard it</option>
          </select>
        </label>
        <p className="text-[12px] text-[#777587]">You can report a need heard from faculty or staff. Name someone only with their permission; faculty and non-student accounts are not open yet.</p>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.hideName} onChange={(e) => set("hideName", e.target.checked)} /> Hide my name</label>
        <p className="text-[12px] font-semibold text-[#b45309]">Private until accept</p>
        <textarea value={form.approach} onChange={(e) => set("approach", e.target.value)} rows={3} placeholder="Deeper notes — unlocks after you accept a builder" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#b45309]/25" />
        <label className="block text-[12px] font-medium text-[#464555]">
          Contact email (your university address)
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder={user?.email || "you@university.edu"}
            className="mt-1 w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#b45309]/25"
          />
        </label>
        <label className="flex items-start gap-2 text-[13px] text-[#1b1b24]">
          <input type="checkbox" checked={form.notAcademicWork} onChange={(e) => set("notAcademicWork", e.target.checked)} className="mt-1" />
          <span>
            This is not graded coursework, an exam, or an assignment.
            <span className="block text-[12px] text-[#777587]">Attest is for real problems, not homework help.</span>
          </span>
        </label>
        {detectAcademicRequest(`${form.title}\n${form.whatHappens}\n${form.fixWouldChange}\n${form.approach}`) && (
          <p className="text-[12px] text-[#92400e]">This reads like coursework. If it is, please don&apos;t post it here — posts like this are reviewed by a moderator.</p>
        )}
        {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
        {draft && <p className="text-[13px] whitespace-pre-wrap rounded-lg bg-[#fffbf5] border border-[#f3e6d4] p-3">{draft}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-[#b45309] text-white text-[13px] font-semibold hover:bg-[#92400e] transition-colors disabled:opacity-60">{busy ? "Posting…" : "Post problem"}</button>
          <button type="button" className="px-4 py-2 rounded-lg border border-[#e8d9c4] text-[13px] text-[#b45309] hover:bg-[#fffbf5] transition-colors" onClick={async () => {
            if (!token) return;
            const result = await draftText(token, "problem", form.whatHappens || "campus problem");
            setDraft(result.enabled ? result.draft : (result.message || "Drafting is off for this sprint — write the problem in your own words."));
          }}>Draft public text</button>
        </div>
      </form>
    </div>
  );
}

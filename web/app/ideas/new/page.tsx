"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  confirmAdult,
  createSprintIdea,
  draftText,
  uploadDocument,
  waitForDocument,
  uploadSprintIdeaImage,
  CampusApiError,
} from "@/lib/campus-api";
import { resizeImage } from "@/lib/resize-image";
import EmptyState from "@/components/campus/EmptyState";
import { CURRENCIES, DEAL_TYPE_LABELS, DEAL_TYPES, LICENCES, detectAcademicRequest, isAcademicEmail, isPaidDeal, type DealType } from "@embedra/types";

const DEAL_HELP: Record<DealType, string> = {
  paid_fixed: "You pay builders a fixed amount per milestone, directly (UPI, bank, Payoneer, Wise…). Attest never holds the money.",
  sponsor_stipend: "A sponsor (club, company, NGO) funds a stipend for the builders. Still paid directly, milestone by milestone.",
  open_source: "The work is public under an open licence. Builders get credit and signed proof.",
  co_owned: "Builders become co-owners. Write the split in the compensation sentence; get it in writing before you start.",
  credit_only: "No money and no ownership. Builders get credit and signed proof only.",
};

const empty = {
  title: "",
  blurb: "",
  pitch: "",
  audience: "",
  gap: "",
  ships: "",
  helpNeeded: "Build",
  stage: "idea",
  isSmall: false,
  hourCap: "",
  compensationSentence: "",
  hideName: false,
  visibility: "standard" as "minimal" | "standard" | "open",
  approach: "",
  contactEmail: "",
  dealType: "credit_only" as DealType,
  currency: "INR",
  budget: "",
  licence: "MIT",
  notAcademicWork: false,
  campusOnly: false,
};

const MIN: Partial<Record<keyof typeof empty, number>> = {
  pitch: 40,
  ships: 40,
  audience: 12,
  gap: 12,
  approach: 10,
  blurb: 12,
};

function formatDetails(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details;
  if (Array.isArray(details)) {
    return details
      .map((row) => {
        if (row && typeof row === "object" && "path" in row && "message" in row) {
          const path = Array.isArray((row as { path: unknown }).path)
            ? (row as { path: (string | number)[] }).path.join(".")
            : String((row as { path: unknown }).path);
          return `${path}: ${(row as { message: string }).message}`;
        }
        return String(row);
      })
      .join(" · ");
  }
  if (details && typeof details === "object" && "fieldErrors" in details) {
    const fields = (details as { fieldErrors: Record<string, string[] | undefined> }).fieldErrors;
    const lines = Object.entries(fields)
      .flatMap(([key, msgs]) => (msgs || []).map((msg) => `${labelFor(key)}: ${msg}`));
    if (lines.length) return [...new Set(lines)].join(" · ");
  }
  if (typeof details === "object") return JSON.stringify(details);
  return null;
}

function labelFor(key: string) {
  const map: Record<string, string> = {
    contactEmail: "Contact email",
    pitch: "Pitch",
    ships: "Two-week outcome",
    audience: "Audience",
    gap: "Gap",
    approach: "Approach",
    blurb: "Teaser",
    title: "Title",
    helpNeeded: "Open roles",
  };
  return map[key] || key;
}

export default function NewSprintIdeaPage() {
  const { user, token, isLoading, setCurrentUser } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const briefInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const set = (key: keyof typeof empty, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

  React.useEffect(() => {
    if (!user?.email) return;
    setForm((prev) => (prev.contactEmail.trim() ? prev : { ...prev, contactEmail: user.email }));
  }, [user?.email]);

  if (isLoading) {
    return <div className="px-5 py-10 text-[14px] text-[#777587]">Loading…</div>;
  }
  if (!user) return null;
  if (user.profileComplete === false) {
    return (
      <div className="px-5 py-10 max-w-lg mx-auto">
        <EmptyState
          title="Finish your profile first"
          body="Name, branch, interests, and a two-week line — then you can post a sprint idea."
          actionHref="/profile"
          actionLabel="Open profile steps"
        />
      </div>
    );
  }

  const applyBrief = async (file: File | undefined) => {
    if (!token || !file) return;
    setBriefBusy(true);
    setError(null);
    setDraftNote(null);
    try {
      const uploaded = await uploadDocument(token, "idea_brief", file);
      const doc = await waitForDocument(token, uploaded.id);
      if (doc.status === "failed") {
        setError(doc.error || "Could not read that file");
        return;
      }
      const brief = doc.result?.ideaBrief;
      if (!brief) {
        setDraftNote("Nothing useful found. Fill the brief by hand.");
        return;
      }
      setForm((prev) => ({
        ...prev,
        title: brief.title || prev.title,
        blurb: brief.blurb || prev.blurb,
        pitch: brief.pitch || prev.pitch,
        audience: brief.audience || prev.audience,
        gap: brief.gap || prev.gap,
        ships: brief.ships || prev.ships,
        approach: brief.approach || prev.approach,
      }));
      setDraftNote(`Filled from your brief${doc.result?.usedOcr ? " (OCR)" : ""}. Review every field before posting. The upload was deleted after parse.`);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not read the brief");
    } finally {
      setBriefBusy(false);
      if (briefInput.current) briefInput.current.value = "";
    }
  };

  const submit = async (event: React.FormEvent) => {
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
    const paid = isPaidDeal(form.dealType);
    if (paid && !(Number(form.budget) > 0)) {
      setError("Add a budget for a paid project");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createSprintIdea(token, {
        title: form.title.trim(),
        blurb: (form.blurb || form.pitch).trim().slice(0, 160),
        pitch: form.pitch.trim(),
        audience: form.audience.trim(),
        gap: form.gap.trim(),
        ships: form.ships.trim(),
        helpNeeded: form.helpNeeded.split(",").map((role) => role.trim()).filter(Boolean),
        stage: form.stage,
        isSmall: form.isSmall,
        hourCap: form.hourCap ? Number(form.hourCap) : null,
        compensationSentence: form.compensationSentence.trim() || undefined,
        hideName: form.hideName,
        visibility: form.visibility,
        approach: form.approach.trim(),
        contactEmail,
        dealType: form.dealType,
        currency: paid ? form.currency : null,
        budget: paid ? Number(form.budget) : null,
        licence: form.dealType === "open_source" ? form.licence : null,
        notAcademicWork: true,
        campusOnly: form.campusOnly,
      });
      for (const file of pendingImages.slice(0, 3)) {
        const resized = await resizeImage(file);
        await uploadSprintIdeaImage(token, result.idea.id, resized);
      }
      router.push(`/ideas/${result.idea.id}`);
    } catch (err) {
      if (err instanceof CampusApiError) {
        const detail = formatDetails(err.details);
        setError(detail ? `${err.message}. ${detail}` : err.message);
      } else {
        setError("Could not post");
      }
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof empty, label: string, area = false) => {
    const min = MIN[key];
    const value = String(form[key]);
    const len = value.trim().length;
    return (
      <label className="block text-[12px] font-medium text-[#464555]">
        <span className="flex items-baseline justify-between gap-2">
          <span>{label}</span>
          {min != null && (
            <span className={`text-[11px] font-normal ${len >= min ? "text-[#777587]" : "text-[#ba1a1a]"}`}>
              {len}/{min}
            </span>
          )}
        </span>
        {area ? (
          <textarea value={value} onChange={(e) => set(key, e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]" />
        ) : (
          <input value={value} onChange={(e) => set(key, e.target.value)} className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]" />
        )}
      </label>
    );
  };

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl mx-auto">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Post a project</p>
      <h1 className="font-serif text-[34px] font-semibold tracking-tight">Post an idea</h1>
      <p className="text-[14px] text-[#464555] mt-1">
        Share the need and the outcome so student builders anywhere can decide whether to help. Keep any secret implementation detail out of the public brief. Your approach stays private until you accept someone, unless you pick Open.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#eceaf4] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">1 · Optional autofill</p>
          <p className="text-[12px] text-[#777587]">PDF, PNG or JPG. We delete the file after reading. Three brief uploads per hour.</p>
          <input
            ref={briefInput}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => applyBrief(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={briefBusy}
            onClick={() => briefInput.current?.click()}
            className="px-3 py-2 rounded-lg border border-[#4f46e5] text-[#4f46e5] text-[13px] font-semibold disabled:opacity-50"
          >
            {briefBusy ? "Reading…" : "Upload brief"}
          </button>
        </section>

        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#eceaf4] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">2 · Public brief</p>
          {field("title", "Title")}
          <fieldset className="space-y-2">
            <legend className="text-[12px] font-medium text-[#464555]">Public visibility</legend>
            {([
              ["minimal", "Minimal — teaser + roles only until accept"],
              ["standard", "Standard — full brief public, approach gated"],
              ["open", "Open — brief + approach readable; contact still gated"],
            ] as const).map(([value, label]) => (
              <label key={value} className="flex items-start gap-2 text-[13px] text-[#464555]">
                <input
                  type="radio"
                  name="visibility"
                  checked={form.visibility === value}
                  onChange={() => set("visibility", value)}
                  className="mt-1"
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <p className="text-[12px] text-[#777587]">Visibility controls who sees your details; it cannot stop someone from building a similar idea. A timestamp records your post, not exclusive ownership.</p>
          {field("blurb", "Short public teaser (required for Minimal)")}
          {field("pitch", "Pitch", true)}
          {field("audience", "Who it is for")}
          {field("ships", "What will exist in two weeks", true)}
          {field("gap", "What is still missing")}
          {field("helpNeeded", "Open roles, comma separated")}
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={form.isSmall} onChange={(e) => set("isSmall", e.target.checked)} />
            Small build with an hour cap
          </label>
          {form.isSmall && field("hourCap", "Hour cap")}
          {field("compensationSentence", "Compensation, one sentence. Leave blank for volunteer.")}
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={form.campusOnly} onChange={(e) => set("campusOnly", e.target.checked)} className="mt-1" />
            <span>
              Only my campus can see this.
              <span className="block text-[12px] text-[#777587]">Good for hardware builds and anything you&apos;d rather do in person. Other universities won&apos;t see it anywhere.</span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={form.hideName} onChange={(e) => set("hideName", e.target.checked)} />
            Hide my name. Branch and semester still show.
          </label>
        </section>

        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#eceaf4] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">3 · How builders are rewarded</p>
          <fieldset className="grid sm:grid-cols-2 gap-2">
            <legend className="sr-only">Deal type</legend>
            {DEAL_TYPES.map((type) => (
              <label
                key={type}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px] cursor-pointer ${form.dealType === type ? "border-[#4f46e5] bg-[#f8f9ff]" : "border-[#e4e2ee]"}`}
              >
                <input type="radio" name="dealType" checked={form.dealType === type} onChange={() => set("dealType", type)} className="mt-1" />
                <span>
                  <span className="font-semibold text-[#1b1b24]">{DEAL_TYPE_LABELS[type]}</span>
                  <span className="block text-[12px] text-[#777587]">{DEAL_HELP[type]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {isPaidDeal(form.dealType) && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <label className="block text-[12px] font-medium text-[#464555]">
                  Currency
                  <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className="mt-1 block rounded-lg border border-[#c7c4d8] px-2 py-2 text-[14px]">
                    {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
                  </select>
                </label>
                <label className="block flex-1 text-[12px] font-medium text-[#464555]">
                  Total budget
                  <input type="number" min="1" step="any" inputMode="decimal" value={form.budget} onChange={(e) => set("budget", e.target.value)} className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]" placeholder="5000" />
                </label>
              </div>
              <p className="text-[12px] text-[#777587]">You split this into milestones when you make a deal with a builder. Builders pay Attest nothing.</p>
              {!user.isAdult && (
                <div className="rounded-xl bg-[#fffbeb] border border-[#fde68a] p-3 text-[12px] text-[#78350f]">
                  Paid projects need both sides to be 18 or older.{" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await confirmAdult(token);
                        setCurrentUser({ ...user, isAdult: true });
                      } catch (err) {
                        setError(err instanceof CampusApiError ? err.message : "Could not save");
                      }
                    }}
                  >
                    I confirm I am 18 or older
                  </button>
                </div>
              )}
            </div>
          )}
          {form.dealType === "open_source" && (
            <label className="block text-[12px] font-medium text-[#464555]">
              Licence
              <select value={form.licence} onChange={(e) => set("licence", e.target.value)} className="mt-1 block rounded-lg border border-[#c7c4d8] px-2 py-2 text-[14px]">
                {LICENCES.map((code) => <option key={code}>{code}</option>)}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-[#777587]">MIT or Apache-2.0 for code; CERN-OHL for hardware.</span>
            </label>
          )}
        </section>

        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#eceaf4] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">4 · Photos · 1 hero + up to 2 figures</p>
          <p className="text-[12px] text-[#777587]">PNG, JPG or WebP. Large photos are compressed before upload. First image is the feed hero.</p>
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []).slice(0, 3 - pendingImages.length);
              setPendingImages((prev) => [...prev, ...picked].slice(0, 3));
              if (imageInput.current) imageInput.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => imageInput.current?.click()}
            disabled={pendingImages.length >= 3}
            className="px-3 py-2 rounded-lg border border-[#4f46e5] text-[#4f46e5] text-[13px] font-semibold disabled:opacity-50"
          >
            Add images ({pendingImages.length}/3)
          </button>
          {pendingImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {pendingImages.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative rounded-lg overflow-hidden bg-[#f1f0f7] aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] font-semibold">
                    {index === 0 ? "Hero" : "Figure"}
                  </span>
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] font-semibold"
                    onClick={() => setPendingImages((list) => list.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl p-5 space-y-3 border border-[#e0e7ff] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#4f46e5]">5 · Private until accept</p>
          {field("approach", "Approach — how you plan to build it", true)}
          <label className="block text-[12px] font-medium text-[#464555]">
            Contact email (your university address)
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
              placeholder={user?.email || "you@university.edu"}
              className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
            />
            <span className="mt-1 block text-[11px] font-normal text-[#777587]">
              Teammates see this only after you accept them. Defaults to your login email.
            </span>
          </label>
        </section>

        <section className="rounded-2xl p-4 border border-[#e4e2ee] bg-[#fafafa] space-y-2">
          <label className="flex items-start gap-2 text-[13px] text-[#1b1b24]">
            <input type="checkbox" checked={form.notAcademicWork} onChange={(e) => set("notAcademicWork", e.target.checked)} className="mt-1" />
            <span>
              This is not graded coursework, an exam, or an assignment.
              <span className="block text-[12px] text-[#777587]">Attest is for real projects. Capstones are fine only as open collaboration your instructor knows about — never as paid work you hand in.</span>
            </span>
          </label>
          {detectAcademicRequest(`${form.title}\n${form.pitch}\n${form.ships}\n${form.approach}`) && (
            <p className="text-[12px] text-[#92400e]">This reads like coursework. If it is, please don&apos;t post it here — posts like this are reviewed by a moderator.</p>
          )}
        </section>

        {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
        {draftNote && <p className="text-[13px] text-[#464555] whitespace-pre-wrap rounded-xl bg-[#f8f9ff] border border-[#e0e7ff] p-3">{draftNote}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold">{busy ? "Posting…" : "Post idea"}</button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg border border-[#c7c4d8] text-[13px]"
            onClick={async () => {
              if (!token || form.pitch.trim().length < 8) {
                setDraftNote("Add a few notes in the pitch first.");
                return;
              }
              const result = await draftText(token, "idea", form.pitch);
              setDraftNote(result.enabled ? result.draft : (result.message || "Drafting is off for this sprint — write the pitch in your own words."));
            }}
          >
            Draft public text
          </button>
        </div>
      </form>
    </div>
  );
}

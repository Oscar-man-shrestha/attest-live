"use client";

import React, { useMemo, useRef, useState } from "react";
import type { DocumentExtraction } from "@embedra/types";
import { uploadDocument, waitForDocument, CampusApiError } from "@/lib/campus-api";

export type Project = { title: string; url?: string; summary?: string };
export type Certification = { name: string; issuer?: string; year?: number; url?: string };
export type Experience = { role: string; org: string; period?: string };

export type ProofDraft = {
  githubUrl: string;
  linkedinUrl: string;
  siteUrl: string;
  projects: Project[];
  certifications: Certification[];
  experience: Experience[];
};

type Props = {
  token: string;
  value: ProofDraft;
  onChange: (next: ProofDraft) => void;
  /** Called with the resume extraction so the page can fill fields owned by other steps. */
  onResume: (result: DocumentExtraction) => string[];
};

const input = "w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";
const small = "rounded-lg border border-[#c7c4d8] px-2 py-1.5 text-[13px]";

function mergeBy<T>(current: T[], found: T[], key: (item: T) => string, cap: number) {
  const seen = new Set(current.map((item) => key(item).toLowerCase()));
  const added = found.filter((item) => {
    const k = key(item).toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { next: [...current, ...added].slice(0, cap), added: Math.min(added.length, Math.max(0, cap - current.length)) };
}

function getSuspiciousReason(project: Project): string | null {
  const title = project.title.trim();
  if (!title) return "Missing title";
  if (title.length < 3) return "Too short (under 3 chars)";
  const lower = title.toLowerCase();

  // Trailing punctuation like period or semicolon (indicates a bullet sentence fragment)
  if (/[.;]$/.test(title) && title.split(/\s+/).length >= 3) return "Sentence fragment ending in punctuation";

  // Headers / metadata labels (e.g. "Technologies:", "Techonologies:", "Tech Stack:", "Tools used:", "Role:", "Key features:")
  if (/^(tech|tool|skill|feature|role|duration|overview|description|note|framework|librar|platform)/i.test(lower) && (title.includes(":") || title.includes("–") || title.includes("-"))) {
    return "Metadata / technology label";
  }

  // Generic header lines
  const genericHeaders = [
    "project", "projects", "academic project", "academic projects",
    "personal project", "personal projects", "key project", "key projects",
    "system", "application", "website", "tech stack", "technologies", "techonologies",
    "tools", "tools used", "description", "overview", "key features", "work done",
    "responsibilities", "highlights", "architecture", "methodology"
  ];
  if (genericHeaders.includes(lower)) return "Generic header fragment";

  // Action verbs starting bullet sentence (e.g. "Developed...", "Built...", "Implemented...", "Iterative...", "Smooth...")
  if (/^(developed|building|built|designed|implement(ed|ing)?|created|worked|engineered|conducted|assisted|programmed|deployed|tested|optimized|enhanced|automated|contributed|spearheaded|facilitated|established|researched|trained|iterative|smooth|utilized|utilizing|performed|analyzed|configured|authored|collaborated)\b/i.test(lower)) {
    return "Action verb bullet line";
  }

  // Fragment starting with lowercase or connecting words
  if (/^(and|or|with|for|to|using|by|in|via|from|etc|including)\b/i.test(lower)) {
    return "Continuation fragment";
  }

  // Single word fragments that are purely stopwords or generic lowercase
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    if (["the", "and", "with", "from", "for", "etc", "none", "true", "false", "test", "demo", "link", "links"].includes(lower)) {
      return "Single stopword fragment";
    }
    // If it's pure lowercase generic word under 5 letters
    if (title === lower && title.length < 5) {
      return "Short lowercase fragment";
    }
  }

  return null;
}

function looksSuspiciousProject(project: Project) {
  return getSuspiciousReason(project) !== null;
}

export default function ProofStep({ token, value, onChange, onResume }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"resume" | "certificate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<ProofDraft | null>(null);
  const [proposed, setProposed] = useState<Project[] | null>(null);
  const [keep, setKeep] = useState<Record<number, boolean>>({});
  const resumeInput = useRef<HTMLInputElement>(null);
  const certInput = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<ProofDraft>) => onChange({ ...value, ...patch });

  const suspiciousOnProfile = useMemo(
    () => value.projects.map((p, i) => (looksSuspiciousProject(p) ? i : -1)).filter((i) => i >= 0),
    [value.projects],
  );

  const read = async (kind: "resume" | "certificate", file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStatus(null);
    setBusy(kind);
    try {
      const { id } = await uploadDocument(token, kind, file);
      setStatus(kind === "resume" ? "Reading your resume…" : "Reading the certificate…");
      const doc = await waitForDocument(token, id);
      if (doc.status === "failed" || !doc.result) throw new CampusApiError(doc.error || "Could not read this file", 422);
      const result = doc.result;
      setUndo(value);

      if (kind === "resume") {
        const existing = new Set(value.projects.map((p) => p.title.trim().toLowerCase()));
        const fresh = result.projects.filter((p) => p.title.trim() && !existing.has(p.title.trim().toLowerCase()));
        if (fresh.length > 0) {
          setProposed(fresh);
          setKeep(Object.fromEntries(fresh.map((_, i) => [i, !looksSuspiciousProject(fresh[i])])));
        } else {
          setProposed(null);
        }
        const certs = mergeBy(value.certifications, result.certifications, (c) => c.name, 10);
        const experience = mergeBy(value.experience, result.experience, (e) => `${e.role}@${e.org}`, 6);
        const filled: string[] = [];
        const next: ProofDraft = {
          ...value,
          githubUrl: value.githubUrl || result.githubUrl || "",
          linkedinUrl: value.linkedinUrl || result.linkedinUrl || "",
          siteUrl: value.siteUrl || result.siteUrl || "",
          certifications: certs.next,
          experience: experience.next,
        };
        if (!value.githubUrl && result.githubUrl) filled.push("GitHub");
        if (!value.linkedinUrl && result.linkedinUrl) filled.push("LinkedIn");
        if (fresh.length) filled.push(`${fresh.length} project suggestion${fresh.length > 1 ? "s" : ""} to review`);
        if (certs.added) filled.push(`${certs.added} certification${certs.added > 1 ? "s" : ""}`);
        if (experience.added) filled.push(`${experience.added} role${experience.added > 1 ? "s" : ""}`);
        onChange(next);
        filled.push(...onResume(result));
        setStatus(filled.length
          ? `Filled from your resume${result.usedOcr ? " (OCR)" : ""}: ${filled.join(", ")}. Review projects before they stay.`
          : "Nothing new found in the resume. You can add details by hand.");
      } else {
        const certs = mergeBy(value.certifications, result.certifications, (c) => c.name, 10);
        onChange({ ...value, certifications: certs.next });
        setStatus(certs.added
          ? `Added ${certs.added} certification${certs.added > 1 ? "s" : ""}${result.usedOcr ? " (OCR)" : ""}. Check the names.`
          : "Nothing new found on the certificate.");
      }
    } catch (err) {
      setStatus(null);
      setError(err instanceof CampusApiError ? err.message : "Upload failed");
    } finally {
      setBusy(null);
      if (resumeInput.current) resumeInput.current.value = "";
      if (certInput.current) certInput.current.value = "";
    }
  };

  const applyProposed = () => {
    if (!proposed) return;
    const chosen = proposed.filter((_, i) => keep[i]);
    const merged = mergeBy(value.projects, chosen, (p) => p.title, 6);
    onChange({ ...value, projects: merged.next });
    setProposed(null);
    setKeep({});
    setStatus(chosen.length ? `Kept ${chosen.length} project${chosen.length > 1 ? "s" : ""}.` : "Discarded all suggested projects.");
  };

  const updateAt = <K extends "projects" | "certifications" | "experience">(key: K, index: number, patch: Partial<ProofDraft[K][number]>) => {
    const list = [...value[key]] as ProofDraft[K][number][];
    list[index] = { ...list[index], ...patch };
    set({ [key]: list } as Partial<ProofDraft>);
  };
  const removeAt = (key: "projects" | "certifications" | "experience", index: number) =>
    set({ [key]: value[key].filter((_, i) => i !== index) } as Partial<ProofDraft>);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-[#c7c4d8] p-4 bg-[#fafaff]">
        <p className="text-[13px] font-semibold">Upload your resume to fill this in</p>
        <p className="text-[12px] text-[#777587] mt-0.5">PDF, PNG or JPG up to 5 MB. Scanned pages are read with OCR. The file is deleted once it is read; only what you keep is saved.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <input ref={resumeInput} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => read("resume", e.target.files?.[0])} />
          <button type="button" disabled={Boolean(busy)} onClick={() => resumeInput.current?.click()} className="px-3 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold disabled:opacity-50">
            {busy === "resume" ? "Reading…" : "Upload resume"}
          </button>
          {undo && !busy && (
            <button type="button" onClick={() => { onChange(undo); setUndo(null); setProposed(null); setStatus("Undone."); }} className="px-3 py-2 rounded-lg border text-[13px]">Undo autofill</button>
          )}
        </div>
        {status && <p className="text-[12px] text-[#3730a3] mt-2">{status}</p>}
        {error && <p className="text-[12px] text-[#ba1a1a] mt-2">{error}</p>}
      </div>

      {proposed && proposed.length > 0 && (
        <div className="rounded-xl border border-[#c7c4d8] bg-white p-4 space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[14px] font-semibold text-[#141b2b]">Review projects from your resume</p>
              <p className="text-[12px] text-[#777587] mt-0.5">
                Check the projects you want to keep. We flagged short or suspicious title fragments so you can fix or uncheck them before merging.
              </p>
            </div>
            <div className="flex gap-2 text-[12px] text-[#4f46e5]">
              <button type="button" onClick={() => setKeep(Object.fromEntries(proposed.map((_, i) => [i, true])))} className="hover:underline">
                Select all
              </button>
              <span>·</span>
              <button type="button" onClick={() => setKeep(Object.fromEntries(proposed.map((p, i) => [i, !looksSuspiciousProject(p)])))} className="hover:underline">
                Keep clean only
              </button>
              <span>·</span>
              <button type="button" onClick={() => setKeep({})} className="hover:underline">
                Deselect all
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {proposed.map((project, i) => {
              const reason = getSuspiciousReason(project);
              const isChecked = Boolean(keep[i]);
              return (
                <div key={`${project.title}-${i}`} className={`rounded-lg border p-3 transition-colors ${reason ? "border-[#f5c2c0] bg-[#fff8f7]" : "border-[#e4e2ee] bg-[#fafaff]"}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`proposed-p-${i}`}
                      checked={isChecked}
                      onChange={(e) => setKeep((k) => ({ ...k, [i]: e.target.checked }))}
                      className="mt-1 h-4 w-4 rounded accent-[#4f46e5]"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor={`proposed-p-${i}`} className="font-medium text-[14px] text-[#141b2b] cursor-pointer">
                          {project.title || "(Untitled fragment)"}
                        </label>
                        {reason ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#ffebeb] text-[#ba1a1a] border border-[#f5c2c0]">
                            ⚠️ {reason}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#eef0ff] text-[#3730a3]">
                            ✓ Clean suggestion
                          </span>
                        )}
                      </div>

                      {isChecked && (
                        <div className="grid sm:grid-cols-[1fr_1fr] gap-2 pt-1">
                          <input
                            value={project.title}
                            onChange={(e) => {
                              const updated = [...proposed];
                              updated[i] = { ...updated[i], title: e.target.value };
                              setProposed(updated);
                            }}
                            placeholder="Project title"
                            className={small}
                          />
                          <input
                            value={project.url ?? ""}
                            onChange={(e) => {
                              const updated = [...proposed];
                              updated[i] = { ...updated[i], url: e.target.value.trim() || undefined };
                              setProposed(updated);
                            }}
                            placeholder="Project URL (optional)"
                            className={small}
                          />
                          <textarea
                            value={project.summary ?? ""}
                            onChange={(e) => {
                              const updated = [...proposed];
                              updated[i] = { ...updated[i], summary: e.target.value || undefined };
                              setProposed(updated);
                            }}
                            placeholder="What it does, what you built"
                            rows={2}
                            maxLength={280}
                            className={`${small} sm:col-span-2`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={applyProposed}
              className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold hover:bg-[#4338ca]"
            >
              Keep selected ({Object.values(keep).filter(Boolean).length})
            </button>
            <button
              type="button"
              onClick={() => { setProposed(null); setKeep({}); }}
              className="px-3 py-2 rounded-lg border border-[#c7c4d8] text-[13px] text-[#464555] hover:bg-[#f1f3ff]"
            >
              Discard all
            </button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block text-[12px] font-medium">GitHub
          <input value={value.githubUrl} onChange={(e) => set({ githubUrl: e.target.value.trim() })} placeholder="https://github.com/username" className={`mt-1 ${input}`} />
        </label>
        <label className="block text-[12px] font-medium">LinkedIn
          <input value={value.linkedinUrl} onChange={(e) => set({ linkedinUrl: e.target.value.trim() })} placeholder="https://www.linkedin.com/in/name" className={`mt-1 ${input}`} />
        </label>
        <label className="block text-[12px] font-medium">Portfolio
          <input value={value.siteUrl} onChange={(e) => set({ siteUrl: e.target.value.trim() })} placeholder="https://…" className={`mt-1 ${input}`} />
        </label>
      </div>
      <p className="text-[12px] text-[#777587] -mt-3">Attest checks your GitHub profile against the public GitHub API and shows repo counts and languages to idea owners.</p>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">Projects · {value.projects.length} of 6</p>
          <button type="button" disabled={value.projects.length >= 6} onClick={() => set({ projects: [...value.projects, { title: "" }] })} className="text-[12px] text-[#4f46e5] disabled:opacity-40">+ Add project</button>
        </div>
        {suspiciousOnProfile.length > 0 && (
          <p className="text-[12px] text-[#ba1a1a]">Some titles look like OCR fragments. Edit or remove them before saving.</p>
        )}
        {value.projects.map((project, i) => {
          const reason = getSuspiciousReason(project);
          return (
            <div key={i} className={`grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-start rounded-lg p-2 transition-colors ${reason ? "bg-[#fff8f7] border border-[#f5c2c0]" : ""}`}>
              <div className="space-y-1">
                <input value={project.title} onChange={(e) => updateAt("projects", i, { title: e.target.value })} placeholder="Title" className={small} />
                {reason && (
                  <p className="text-[11px] text-[#ba1a1a] font-medium">⚠️ {reason}</p>
                )}
              </div>
              <input value={project.url ?? ""} onChange={(e) => updateAt("projects", i, { url: e.target.value.trim() || undefined })} placeholder="Link (optional)" className={small} />
              <button type="button" onClick={() => removeAt("projects", i)} className="text-[12px] text-[#777587] hover:text-[#ba1a1a] px-2 py-1.5">Remove</button>
              <textarea value={project.summary ?? ""} onChange={(e) => updateAt("projects", i, { summary: e.target.value || undefined })} placeholder="What it does, what you built" rows={2} maxLength={280} className={`${small} sm:col-span-3`} />
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">Certifications · {value.certifications.length} of 10</p>
          <div className="flex gap-3">
            <input ref={certInput} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => read("certificate", e.target.files?.[0])} />
            <button type="button" disabled={Boolean(busy) || value.certifications.length >= 10} onClick={() => certInput.current?.click()} className="text-[12px] text-[#4f46e5] disabled:opacity-40">
              {busy === "certificate" ? "Reading…" : "Upload certificate"}
            </button>
            <button type="button" disabled={value.certifications.length >= 10} onClick={() => set({ certifications: [...value.certifications, { name: "" }] })} className="text-[12px] text-[#4f46e5] disabled:opacity-40">+ Add by hand</button>
          </div>
        </div>
        {value.certifications.map((cert, i) => (
          <div key={i} className="grid sm:grid-cols-[2fr_1fr_80px_1fr_auto] gap-2">
            <input value={cert.name} onChange={(e) => updateAt("certifications", i, { name: e.target.value })} placeholder="Name" className={small} />
            <input value={cert.issuer ?? ""} onChange={(e) => updateAt("certifications", i, { issuer: e.target.value || undefined })} placeholder="Issuer" className={small} />
            <input value={cert.year ?? ""} inputMode="numeric" onChange={(e) => updateAt("certifications", i, { year: Number(e.target.value) || undefined })} placeholder="Year" className={small} />
            <input value={cert.url ?? ""} onChange={(e) => updateAt("certifications", i, { url: e.target.value.trim() || undefined })} placeholder="Verify link" className={small} />
            <button type="button" onClick={() => removeAt("certifications", i)} className="text-[12px] text-[#777587] px-2">Remove</button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">Experience · {value.experience.length} of 6</p>
          <button type="button" disabled={value.experience.length >= 6} onClick={() => set({ experience: [...value.experience, { role: "", org: "" }] })} className="text-[12px] text-[#4f46e5] disabled:opacity-40">+ Add role</button>
        </div>
        {value.experience.map((item, i) => (
          <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <input value={item.role} onChange={(e) => updateAt("experience", i, { role: e.target.value })} placeholder="Role, e.g. Intern" className={small} />
            <input value={item.org} onChange={(e) => updateAt("experience", i, { org: e.target.value })} placeholder="Organisation or club" className={small} />
            <input value={item.period ?? ""} onChange={(e) => updateAt("experience", i, { period: e.target.value || undefined })} placeholder="May 2025 - Jul 2025" className={small} />
            <button type="button" onClick={() => removeAt("experience", i)} className="text-[12px] text-[#777587] px-2">Remove</button>
          </div>
        ))}
      </section>
    </div>
  );
}

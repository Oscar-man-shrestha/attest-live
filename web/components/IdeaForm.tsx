"use client";

import React, { useEffect, useState } from "react";
import { Domain, createIdeaSchema } from "@embedra/types";
import { getDomains } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export interface IdeaFormData {
  title: string;
  description: string;
  domainId: string;
  accessType: "open_open" | "open_closed" | "closed";
  status?: "open" | "closed";
}

interface IdeaFormProps {
  mode: "create" | "edit";
  initialData?: Partial<IdeaFormData>;
  onSubmit: (data: IdeaFormData) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
  submitLabel?: string;
  onCancel?: () => void;
}

export default function IdeaForm({
  mode,
  initialData,
  onSubmit,
  isSubmitting,
  error,
  submitLabel,
  onCancel,
}: IdeaFormProps) {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true);
  const [domainError, setDomainError] = useState<string | null>(null);

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [domainId, setDomainId] = useState(initialData?.domainId || "");
  const [accessType, setAccessType] = useState<"open_open" | "open_closed" | "closed">(
    initialData?.accessType || "open_open"
  );
  const [status, setStatus] = useState<"open" | "closed">(initialData?.status || "open");
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadDomains() {
      try {
        setIsLoadingDomains(true);
        const data = await getDomains();
        if (isMounted) {
          setDomains(data);
          if (!domainId && data.length > 0 && !initialData?.domainId) {
            setDomainId(data[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setDomainError("Failed to load fixed domain list from server.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingDomains(false);
        }
      }
    }

    loadDomains();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (initialData) {
      if (initialData.title !== undefined) setTitle(initialData.title);
      if (initialData.description !== undefined) setDescription(initialData.description);
      if (initialData.domainId !== undefined) setDomainId(initialData.domainId);
      if (initialData.accessType !== undefined) setAccessType(initialData.accessType);
      if (initialData.status !== undefined) setStatus(initialData.status);
    }
  }, [initialData]);

  const insertMarkdown = (prefix: string, suffix: string = "") => {
    setDescription((prev) => `${prev}\n${prefix}${suffix}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientErrors({});

    const formData: IdeaFormData = {
      title: title.trim(),
      description: description.trim(),
      domainId,
      accessType,
      ...(mode === "edit" ? { status } : {}),
    };

    const validation = createIdeaSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const path = err.path[0]?.toString();
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = err.message;
        }
      });
      setClientErrors(fieldErrors);
      return;
    }

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Server or Global Error Banner */}
      {(error || domainError) && (
        <div className="p-4 bg-error-container/30 border border-error/30 rounded-xl text-error text-sm flex items-start gap-3">
          <span className="material-symbols-outlined text-[20px] shrink-0 text-error">error</span>
          <p className="font-ui-body font-medium">{error || domainError}</p>
        </div>
      )}

      {/* Main Editorial Layout: Responsive Grid (Form Mainstream + Contextual Inspector Rail) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

        {/* ════════════════════════════════════════════════════════
            LEFT / PRIMARY FORM AREA (xl:col-span-8)
            ════════════════════════════════════════════════════════ */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* Page Header Banner */}
          <div className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl shadow-sm border border-outline-variant/30">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-meta-code text-[11px] uppercase text-primary-container font-semibold tracking-wider">
                  Hypothesis Initialization
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl lg:text-[32px] font-bold text-on-surface mt-1 mb-1 tracking-tight">
                  {mode === "create" ? "Create an Idea Seed" : "Edit Idea Specification"}
                </h1>
                <p className="font-serif text-[15px] text-on-surface-variant leading-relaxed">
                  State the problem, define the boundary, and set the collaboration permissions.
                </p>
              </div>
              <span className="font-meta-code text-meta-code px-2.5 py-1 rounded-lg bg-surface-container-low text-outline text-[11px] font-semibold border border-outline-variant/30">
                DRAFT_STAGE_01
              </span>
            </div>
          </div>

          {/* CARD 1: Core Definitions */}
          <div className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary-fixed text-primary-container font-meta-code text-[11px] flex items-center justify-center font-bold">
                  1
                </span>
                <h2 className="font-serif text-lg font-semibold text-on-surface">
                  Core Definitions
                </h2>
              </div>
              <span className="font-meta-xs text-[11px] uppercase tracking-wider text-outline font-semibold">
                Metadata Index
              </span>
            </div>

            {/* Title Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="idea-title" className="font-ui-medium text-[14px] text-on-surface font-semibold">
                  Idea Title / Research Premise <span className="text-error">*</span>
                </label>
                <span className={`font-meta-code text-[11px] ${title.length > 100 ? "text-error font-semibold" : "text-outline"}`}>
                  {title.length} / 100 max chars
                </span>
              </div>
              <input
                id="idea-title"
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Real-Time Collaborative Research Graph"
                className={`w-full px-4 py-3 bg-surface-container-low/60 rounded-xl text-on-surface font-serif text-[16px] placeholder:text-outline/60 shadow-xs focus:bg-surface-container-lowest focus:outline-none transition-all border ${
                  clientErrors.title ? "border-error focus:border-error" : "border-outline-variant/30 focus:border-primary"
                }`}
              />
              {clientErrors.title && (
                <p className="font-meta-xs text-meta-xs text-error font-medium">{clientErrors.title}</p>
              )}
            </div>

            {/* Domain Selector & Maturity Stage Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="idea-domain" className="font-ui-medium text-[14px] text-on-surface font-semibold">
                  Primary Domain <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <select
                    id="idea-domain"
                    value={domainId}
                    disabled={isLoadingDomains || domains.length === 0}
                    onChange={(e) => setDomainId(e.target.value)}
                    className="w-full appearance-none px-4 py-2.5 bg-surface-container-low/60 rounded-xl text-on-surface font-ui-medium text-[13px] shadow-xs focus:outline-none focus:bg-surface-container-lowest transition-all cursor-pointer border border-outline-variant/30 focus:border-primary"
                  >
                    {isLoadingDomains ? (
                      <option value="">Loading taxonomy…</option>
                    ) : domains.length === 0 ? (
                      <option value="">No domains available</option>
                    ) : (
                      domains.map((dom) => (
                        <option key={dom.id} value={dom.id}>
                          {dom.name}
                        </option>
                      ))
                    )}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">
                    unfold_more
                  </span>
                </div>
                {clientErrors.domainId && (
                  <p className="font-meta-xs text-meta-xs text-error font-medium">{clientErrors.domainId}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-ui-medium text-[14px] text-on-surface font-semibold">
                  Hypothesis Maturity Stage
                </label>
                <div className="relative">
                  <select className="w-full appearance-none px-4 py-2.5 bg-surface-container-low/60 rounded-xl text-on-surface font-ui-medium text-[13px] shadow-xs focus:outline-none focus:bg-surface-container-lowest transition-all cursor-pointer border border-outline-variant/30 focus:border-primary">
                    <option>Stage 0: Unverified Hypothesis</option>
                    <option>Stage 1: Literature Review In-Progress</option>
                    <option>Stage 2: Architecture PoC / Spec Draft</option>
                    <option>Stage 3: Ready for Formation Cohort</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">
                    expand_more
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: Editorial README / Problem Specification */}
          <div className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary-fixed text-primary-container font-meta-code text-[11px] flex items-center justify-center font-bold">
                  2
                </span>
                <h2 className="font-serif text-lg font-semibold text-on-surface">
                  Editorial README & Problem Specification
                </h2>
              </div>
              {/* Editor Mode Tabs */}
              <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setActiveTab("write")}
                  className={`px-3 py-1 rounded-lg font-ui-medium text-[12px] transition-all cursor-pointer ${
                    activeTab === "write"
                      ? "text-on-primary bg-primary-container shadow-xs font-semibold"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Write Spec
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`px-3 py-1 rounded-lg font-ui-medium text-[12px] transition-all cursor-pointer ${
                    activeTab === "preview"
                      ? "text-on-primary bg-primary-container shadow-xs font-semibold"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Archival Preview
                </button>
              </div>
            </div>

            {/* Markdown Utility Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-surface-container-low/70 rounded-xl border border-outline-variant/20">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => insertMarkdown("**Bold Text**")}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  title="Bold"
                >
                  <span className="material-symbols-outlined text-[18px]">format_bold</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("*Italic Text*")}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  title="Italic"
                >
                  <span className="material-symbols-outlined text-[18px]">format_italic</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("### Section Header")}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  title="Heading"
                >
                  <span className="material-symbols-outlined text-[18px]">title</span>
                </button>
                <span className="w-px h-4 bg-outline-variant/40 mx-1"></span>
                <button
                  type="button"
                  onClick={() => insertMarkdown('> "Quoted thesis"')}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  title="Quote"
                >
                  <span className="material-symbols-outlined text-[18px]">format_quote</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("```typescript\n// Spec implementation\n```")}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  title="Code Block"
                >
                  <span className="material-symbols-outlined text-[18px]">code</span>
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown("- Key milestone item")}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  title="Bullet List"
                >
                  <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                </button>
              </div>
              <span className="font-meta-code text-[11px] text-outline pr-1">
                {description.length} chars (min 10)
              </span>
            </div>

            {/* Description Field / Preview */}
            {activeTab === "write" ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  id="idea-description"
                  rows={10}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="### 1. Problem Statement&#10;Describe the fragile assumptions in existing architectures...&#10;&#10;### 2. Proposed Mechanism&#10;Explain the boundary conditions, protocols, and data structures...&#10;&#10;### 3. Verification & Milestones&#10;Outline the quantitative benchmarks required to validate this hypothesis..."
                  className={`w-full p-4 bg-surface-container-low/50 rounded-xl font-serif text-[16px] leading-relaxed text-on-surface placeholder:text-outline/60 shadow-xs focus:outline-none focus:bg-surface-container-lowest transition-all border ${
                    clientErrors.description ? "border-error focus:border-error" : "border-outline-variant/30 focus:border-primary"
                  }`}
                />
                {clientErrors.description && (
                  <p className="font-meta-xs text-meta-xs text-error font-medium">{clientErrors.description}</p>
                )}
              </div>
            ) : (
              <div className="p-5 bg-surface-container-low/30 rounded-xl font-serif text-[16px] leading-relaxed text-on-surface whitespace-pre-wrap border border-outline-variant/20 min-h-[240px]">
                {description.trim() || (
                  <span className="italic text-outline">No specification text composed yet.</span>
                )}
              </div>
            )}
          </div>

          {/* CARD 3: Access & Collaboration Permissions */}
          <div className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary-fixed text-primary-container font-meta-code text-[11px] flex items-center justify-center font-bold">
                  3
                </span>
                <h2 className="font-serif text-lg font-semibold text-on-surface">
                  Access & Collaboration Permissions
                </h2>
              </div>
              <span className="font-meta-xs text-[11px] uppercase tracking-wider text-outline font-semibold">
                Governance Model
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Open + Open */}
              <label
                className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl cursor-pointer transition-all shadow-xs border ${
                  accessType === "open_open"
                    ? "bg-surface-container-low border-2 border-primary-container shadow-sm"
                    : "bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low/40"
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-meta-code font-semibold bg-secondary-container/40 text-on-secondary-container uppercase">
                      Open + Open
                    </span>
                    <input
                      type="radio"
                      name="accessType"
                      value="open_open"
                      checked={accessType === "open_open"}
                      onChange={() => setAccessType("open_open")}
                      className="w-4 h-4 text-primary-container accent-primary-container"
                    />
                  </div>
                  <h3 className="font-serif text-[16px] font-semibold text-on-surface mb-1">
                    Public & Community
                  </h3>
                  <p className="font-ui-body text-[13px] text-on-surface-variant leading-snug">
                    Publicly discoverable in feed. Anyone can submit a join request to participate in formation cohorts.
                  </p>
                </div>
                <div className="mt-4 pt-2 flex items-center gap-1.5 text-secondary font-ui-medium text-[12px] border-t border-outline-variant/15">
                  <span className="material-symbols-outlined text-[16px]">diversity_3</span>
                  <span>Collaborative Swarms</span>
                </div>
              </label>

              {/* Option 2: Open + Closed */}
              <label
                className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl cursor-pointer transition-all shadow-xs border ${
                  accessType === "open_closed"
                    ? "bg-surface-container-low border-2 border-primary-container shadow-sm"
                    : "bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low/40"
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-meta-code font-semibold bg-tertiary-fixed text-on-tertiary-fixed uppercase">
                      Open + Closed
                    </span>
                    <input
                      type="radio"
                      name="accessType"
                      value="open_closed"
                      checked={accessType === "open_closed"}
                      onChange={() => setAccessType("open_closed")}
                      className="w-4 h-4 text-primary-container accent-primary-container"
                    />
                  </div>
                  <h3 className="font-serif text-[16px] font-semibold text-on-surface mb-1">
                    Public Reading
                  </h3>
                  <p className="font-ui-body text-[13px] text-on-surface-variant leading-snug">
                    Publicly visible for reading and citations, but formation cohort is private and by owner-invitation only.
                  </p>
                </div>
                <div className="mt-4 pt-2 flex items-center gap-1.5 text-tertiary font-ui-medium text-[12px] border-t border-outline-variant/15">
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Curated Core Team</span>
                </div>
              </label>

              {/* Option 3: Closed / Stealth */}
              <label
                className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl cursor-pointer transition-all shadow-xs border ${
                  accessType === "closed"
                    ? "bg-surface-container-low border-2 border-primary-container shadow-sm"
                    : "bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low/40"
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-meta-code font-semibold bg-surface-container text-on-surface-variant uppercase">
                      Stealth
                    </span>
                    <input
                      type="radio"
                      name="accessType"
                      value="closed"
                      checked={accessType === "closed"}
                      onChange={() => setAccessType("closed")}
                      className="w-4 h-4 text-primary-container accent-primary-container"
                    />
                  </div>
                  <h3 className="font-serif text-[16px] font-semibold text-on-surface mb-1">
                    Encrypted Access
                  </h3>
                  <p className="font-ui-body text-[13px] text-on-surface-variant leading-snug">
                    Unlisted link only. Only users with direct cryptographic invite token can discover and join.
                  </p>
                </div>
                <div className="mt-4 pt-2 flex items-center gap-1.5 text-outline font-ui-medium text-[12px] border-t border-outline-variant/15">
                  <span className="material-symbols-outlined text-[16px]">key</span>
                  <span>Pre-Alpha Incubation</span>
                </div>
              </label>
            </div>
          </div>

          {/* Status (Edit mode only) */}
          {mode === "edit" && (
            <div className="bg-surface-container-lowest p-6 sm:p-7 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-4">
              <span className="font-ui-medium text-[14px] text-on-surface font-semibold">
                Lifecycle Status
              </span>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 font-ui-body text-ui-body text-on-surface cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="open"
                    checked={status === "open"}
                    onChange={() => setStatus("open")}
                    className="text-primary-container accent-primary-container"
                  />
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    <span>Open (Active Collaboration)</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 font-ui-body text-ui-body text-on-surface cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="closed"
                    checked={status === "closed"}
                    onChange={() => setStatus("closed")}
                    className="text-primary-container accent-primary-container"
                  />
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-outline" />
                    <span>Closed (Archived Spec)</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Form Actions Footbar */}
          <div className="flex items-center justify-between bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-outline-variant/30">
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-ui-medium text-[13px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-meta-xs text-[11px] text-outline hidden sm:inline">
                Signed via @{user?.username || "author"} key
              </span>
              <button
                type="submit"
                disabled={isSubmitting || isLoadingDomains}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-container text-on-primary font-ui-medium text-[14px] shadow-sm hover:bg-primary transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Transmitting…</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">publish</span>
                    <span>{submitLabel || (mode === "create" ? "Publish Idea to Network" : "Save Changes")}</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* ════════════════════════════════════════════════════════
            RIGHT SIDE INSPECTOR PANEL (xl:col-span-4)
            ════════════════════════════════════════════════════════ */}
        <div className="xl:col-span-4 flex flex-col gap-5 xl:sticky xl:top-20">

          {/* Attest Indexer Card */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary-container flex items-center justify-center text-on-primary font-meta-code text-[11px] font-bold">
                  A
                </div>
                <span className="font-ui-medium text-[13px] font-bold text-on-surface tracking-tight">
                  Attest Indexer
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
            </div>
            <p className="font-ui-body text-on-surface-variant text-[13px] leading-relaxed">
              Ideas registered into Attest enter the peer-review queue for domain-level semantic matching and collective hypothesis refinement.
            </p>
          </div>

          {/* Formation Readiness Ledger Card */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <span className="font-meta-xs text-[11px] uppercase tracking-wider text-outline font-semibold">
                Formation Readiness Ledger
              </span>
              <span className="font-meta-code text-secondary text-[11px] font-semibold">
                Active Audit
              </span>
            </div>
            <div className="flex flex-col gap-2.5 font-label-sm text-[12px]">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-outline">Hypothesis Scope</span>
                <span className="flex items-center gap-1 font-meta-code text-[11px] text-secondary">
                  <span className="material-symbols-outlined text-[15px]">
                    {title.trim().length >= 10 ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>{title.trim().length >= 10 ? "Satisfied" : "Pending"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-outline">Domain Classification</span>
                <span className="flex items-center gap-1 font-meta-code text-[11px] text-secondary">
                  <span className="material-symbols-outlined text-[15px]">
                    {domainId ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>{domainId ? "Classified" : "Unset"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-outline">Collab Access Model</span>
                <span className="flex items-center gap-1 font-meta-code text-[11px] text-secondary">
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                  <span>{accessType}</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-outline">Architecture Spec</span>
                <span className="flex items-center gap-1 font-meta-code text-[11px] text-secondary">
                  <span className="material-symbols-outlined text-[15px]">
                    {description.trim().length >= 10 ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>{description.trim().length >= 10 ? "Drafted" : "Required"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Author Credential Card */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-2.5">
            <span className="font-meta-xs text-[11px] uppercase tracking-wider text-outline font-semibold">
              Author Credential
            </span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary-container font-bold text-xs flex items-center justify-center shadow-xs">
                {(user?.username || "A").charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-ui-medium text-[13px] font-semibold text-on-surface truncate">
                  @{user?.username || "anonymous"}
                </span>
                <span className="font-meta-code text-outline text-[11px]">
                  Principal Proposer
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </form>
  );
}

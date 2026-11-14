"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getProof, publishProof } from "@/lib/campus-api";
import EmptyState from "@/components/campus/EmptyState";

function ProofContent() {
  const { token, user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const paramUser = searchParams.get("user");
  const [page, setPage] = useState<Awaited<ReturnType<typeof getProof>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const otherId = !isLoading && paramUser && user && paramUser !== user.id ? paramUser : undefined;
  const viewingOther = Boolean(otherId);

  useEffect(() => {
    if (!token || isLoading) return;
    setPage(null);
    setError(null);
    getProof(token, otherId)
      .then(setPage)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load proof"));
  }, [token, isLoading, otherId]);

  if (isLoading || !page) {
    return <div className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading proof…"}</div>;
  }

  const own = !viewingOther;
  const signed = page.lines.filter((line) => line.receiptStatus === "signed");
  const other = page.lines.filter((line) => line.receiptStatus !== "signed");

  return (
    <div className="px-5 py-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Signed trail</p>
          <h1 className="font-serif text-[32px] font-semibold">{own ? "Proof" : `${page.displayName ?? "Student"}'s proof`}</h1>
          <p className="text-[14px] text-[#464555] mt-1">
            {!own
              ? "Signed lines from sprint work — the only verified skills on Attest."
              : page.published
                ? "Other students can see your signed lines."
                : "This page is off until you share it. You still see every line of your own."}
          </p>
        </div>
        {token && own && (
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold ${page.published ? "border border-[#c7c4d8]" : "bg-[#4f46e5] text-white"}`}
            onClick={() => publishProof(token, !page.published).then(() => getProof(token).then(setPage))}
          >
            {page.published ? "Stop sharing" : "Share signed lines"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Signed", signed.length],
          ["In progress", other.length],
          ["Visible", page.published ? "Public" : "Private"],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-xl p-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <p className="text-[18px] font-semibold text-[#141b2b]">{value as string | number}</p>
            <p className="text-[11px] text-[#777587]">{label as string}</p>
          </div>
        ))}
      </div>

      {page.lines.length === 0 && (
        own || page.published ? (
          <EmptyState
            title="No signed lines yet"
            body={own
              ? "When an idea owner signs your submitted work, it lands here. Join a team and ship a task to earn your first line."
              : "This student has not shipped signed work in this sprint yet."}
            actionHref={own ? "/ideas" : undefined}
            actionLabel={own ? "Find an idea" : undefined}
            secondaryHref={own ? "/inbox" : undefined}
            secondaryLabel={own ? "Check inbox" : undefined}
          />
        ) : (
          <EmptyState
            title="Proof page is private"
            body="This student has not shared their signed lines yet."
          />
        )
      )}

      {signed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#15803d]">Signed</h2>
          {signed.map((line) => (
            <article key={line.id} className="bg-white rounded-xl p-4 text-[14px] border border-[#dcfce7]">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{line.title}</p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#15803d]">Signed</span>
              </div>
              {line.description && <p className="text-[#464555] mt-1">{line.description}</p>}
              <p className="text-[12px] text-[#777587] mt-2">
                {line.role ? `${line.role} · ` : ""}
                {line.signedAt ? `signed ${new Date(line.signedAt).toLocaleDateString()}` : ""}
              </p>
            </article>
          ))}
        </section>
      )}

      {own && other.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#777587]">Other lines (only you)</h2>
          {other.map((line) => (
            <article key={line.id} className="bg-white rounded-xl p-4 text-[14px]">
              <p className="font-semibold">{line.title}</p>
              {line.description && <p className="text-[#464555]">{line.description}</p>}
              <p className="text-[12px] text-[#777587] mt-1">
                {line.receiptStatus || line.status || "pending"}
                {line.frozenAt ? ` · frozen ${new Date(line.frozenAt).toLocaleString()}` : ""}
                {line.removedAt ? ` · removed ${new Date(line.removedAt).toLocaleString()}` : ""}
              </p>
            </article>
          ))}
        </section>
      )}

      {own && (
        <p className="text-[12px] text-[#777587]">
          Tip: ask owners to sign from the workspace after you submit. Likes on the Ideas board are social — not proof.{" "}
          <Link href="/help" className="text-[#4f46e5] font-semibold">Read the rules →</Link>
        </p>
      )}
    </div>
  );
}

export default function ProofPage() {
  return (
    <Suspense fallback={<div className="px-5 py-10 text-[14px] text-[#777587]">Loading proof…</div>}>
      <ProofContent />
    </Suspense>
  );
}

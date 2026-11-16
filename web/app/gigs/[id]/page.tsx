"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, acceptGigResponse, closeGig, declineGigResponse, getGig, respondToGig, type GigDetail } from "@/lib/campus-api";
import CampusChips from "@/components/campus/CampusChips";
import Stamp from "@/components/brand/Stamp";

export default function GigPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<GigDetail | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=/gigs/${id}`);
  }, [isLoading, user, router, id]);

  const load = useCallback(() => {
    if (!token || !id) return;
    getGig(token, id).then(setData).catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load the gig"));
  }, [token, id]);
  useEffect(load, [load]);

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <p className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading…"}</p>;
  const { gig, responses, myResponse } = data;
  const request = gig.kind === "request";
  const open = gig.status === "open" && !gig.hidden;

  return (
    <div className="px-5 sm:px-8 py-6 max-w-2xl xl:max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto space-y-5">
      <Link href="/gigs" className="text-[13px] text-[#047857]">← Gigs</Link>

      <article className="ticket">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="serial text-[#047857]">{request ? "Needs doing" : "Service"} · {gig.category}</span>
            <span className="serial">{new Date(gig.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
          </div>
          <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight tracking-tight text-[#141b2b]">{gig.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Link href={`/profile/${gig.author.id}`} className="text-[13px] font-semibold text-[#141b2b] hover:underline">@{gig.author.handle}</Link>
            <CampusChips sameCampus={gig.sameCampus} campusOnly={gig.campusOnly} />
            {gig.kitId && <Link href={`/kits/${gig.kitId}`} className="rounded-full border border-[#c9eedd] bg-[#f4fdf8] px-2 py-0.5 text-[11px] font-semibold text-[#047857]">See the whole kit →</Link>}
            {!open && <span className="rounded-full bg-[#f5f5f4] px-2 py-0.5 text-[11px] font-semibold text-[#57534e]">{gig.hidden ? "Hidden by a moderator" : "Closed"}</span>}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-[#1f2433]">{gig.description}</p>
        </div>
        <div className="ticket-tear" />
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="serial">{gig.paid ? (request ? "Pays" : "Price") : "Reward"}</p>
            <p className={`ledger text-[26px] font-bold ${gig.paid ? "text-[#047857]" : "text-[#464555]"}`}>{gig.price ?? "Credit + proof"}</p>
          </div>
          <div className="text-right text-[12px] text-[#777587]">
            {gig.deliveryDays ? <p className="serial">Delivery · {gig.deliveryDays} day{gig.deliveryDays === 1 ? "" : "s"}</p> : null}
            {gig.paid && <p className="mt-1 max-w-[220px]">Paid directly after the work is accepted. Attest never holds money.</p>}
          </div>
        </div>
      </article>

      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}

      {/* Visitor: respond */}
      {!gig.mine && (
        <section className="rounded-2xl border border-[#e4e2ee] bg-white p-5 space-y-3">
          {myResponse ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold text-[#141b2b]">Your response</h2>
                {myResponse.status === "hired" && <Stamp icon="handshake" thunk>Accepted</Stamp>}
                {myResponse.status === "declined" && <Stamp tone="muted" flat>Declined</Stamp>}
                {myResponse.status === "new" && <span className="serial">Waiting for @{gig.author.handle}</span>}
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-[#464555]">{myResponse.note}</p>
              {myResponse.engagementId && (
                <Link href={`/deals/${myResponse.engagementId}`} className="inline-flex rounded-lg bg-[#047857] px-3 py-2 text-[13px] font-semibold text-white">Open the deal →</Link>
              )}
            </>
          ) : open ? (
            <>
              <h2 className="text-[14px] font-semibold text-[#141b2b]">{request ? "Offer to do this" : "Request this service"}</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={request ? "Why you're a good fit and when you can deliver. Add a link to similar work if you have one." : "What you need, in a sentence or two, and by when."}
                className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
              />
              <p className="text-[12px] text-[#777587]">
                Only @{gig.author.handle} sees your note. If they accept, a one-milestone deal starts{gig.paid ? ` at ${gig.price}` : ""}.
                {gig.paid && !user?.isAdult ? " Paid gigs need you to confirm you're 18 or older in Profile → Account first." : ""}
              </p>
              <button
                type="button"
                disabled={busy === "respond" || note.trim().length < 12}
                onClick={() => run("respond", () => respondToGig(token!, gig.id, note.trim()))}
                className="rounded-xl bg-[#047857] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busy === "respond" ? "Sending…" : request ? "I can do this" : "Send request"}
              </button>
            </>
          ) : (
            <p className="text-[14px] text-[#777587]">This gig is closed.</p>
          )}
        </section>
      )}

      {/* Author: responses */}
      {gig.mine && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#777587]">Responses ({responses.length})</h2>
            {open && (
              <button type="button" disabled={busy === "close"} onClick={() => run("close", () => closeGig(token!, gig.id))} className="text-[12px] text-[#777587] hover:text-[#ba1a1a]">
                Close this gig
              </button>
            )}
          </div>
          {responses.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#c7c4d8] bg-white p-5 text-[14px] text-[#777587]">
              No responses yet. Share the link with people on your campus, or check back later — you&apos;ll get an email when someone responds.
            </p>
          )}
          {responses.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[#e4e2ee] bg-white p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/profile/${r.user?.id}`} className="text-[14px] font-semibold text-[#141b2b] hover:underline">@{r.user?.handle}</Link>
                  <CampusChips sameCampus={r.user?.sameCampus} />
                  <Link href={`/profile/${r.user?.id}`} className="text-[12px] text-[#4f46e5]">See their record</Link>
                </div>
                {r.status === "hired" && <Stamp icon="handshake" flat>Accepted</Stamp>}
                {r.status === "declined" && <Stamp tone="muted" flat>Declined</Stamp>}
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-[#464555]">{r.note}</p>
              {r.status === "new" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={async () => {
                      setBusy(r.id);
                      setError(null);
                      try {
                        const result = await acceptGigResponse(token!, r.id);
                        router.push(`/deals/${result.engagementId}`);
                      } catch (err) {
                        setError(err instanceof CampusApiError ? err.message : "Could not accept");
                        setBusy(null);
                      }
                    }}
                    className="rounded-lg bg-[#047857] px-3 py-1.5 text-[12px] font-semibold text-white"
                  >
                    {request ? "Hire — start the deal" : "Accept — start the deal"}
                  </button>
                  <button type="button" disabled={busy === r.id} onClick={() => run(r.id, () => declineGigResponse(token!, r.id))} className="rounded-lg border border-[#c7c4d8] px-3 py-1.5 text-[12px] font-semibold">
                    Decline
                  </button>
                </div>
              )}
              {r.engagementId && <Link href={`/deals/${r.engagementId}`} className="inline-block text-[13px] font-semibold text-[#047857]">Open the deal →</Link>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

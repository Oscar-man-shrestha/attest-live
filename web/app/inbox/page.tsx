"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getInbox,
  markAllNoticesRead,
  markNoticeRead,
  type InboxOffer,
  type InboxPayload,
} from "@/lib/campus-api";
import EmptyState from "@/components/campus/EmptyState";
import { Avatar, timeAgo } from "@/components/campus/CommentThread";

type Tab = "action" | "incoming" | "outgoing" | "invites" | "notices";

const TAB_LABEL: Record<Tab, string> = {
  action: "Needs you",
  incoming: "Join requests",
  outgoing: "Your asks",
  invites: "Invites",
  notices: "Notices",
};

function FitBadge({ score, reasons }: { score?: number; reasons?: string[] }) {
  if (score == null || score <= 0) return null;
  const tone = score >= 70 ? "bg-[#dcfce7] text-[#15803d]" : score >= 40 ? "bg-[#eef2ff] text-[#3730a3]" : "bg-[#f1f0f7] text-[#777587]";
  return (
    <div className="space-y-1">
      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${tone}`}>{score}% fit</span>
      {reasons && reasons.length > 0 && (
        <p className="text-[11px] text-[#777587]">{reasons.join(" · ")}</p>
      )}
    </div>
  );
}

function OfferCard({ offer }: { offer: InboxOffer }) {
  return (
    <Link href={`/offers/${offer.id}`} className="block bg-white rounded-xl p-4 mt-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_14px_rgba(79,70,229,0.08)] transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {offer.builder && <Avatar name={offer.builder.displayName} src={offer.builder.profilePicUrl} size={32} />}
            <div className="min-w-0">
              <p className="font-medium text-[14px] truncate">
                {offer.builder?.displayName || "Applicant"}
                {offer.builder?.branch ? ` · ${offer.builder.branch}` : ""}
                {offer.builder?.semester ? ` Sem ${offer.builder.semester}` : ""}
              </p>
              <p className="text-[12px] text-[#777587] truncate">{offer.title}</p>
            </div>
          </div>
          <p className="text-[13px] text-[#464555] mt-2 line-clamp-2">{offer.body}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(offer.skills || []).slice(0, 4).map((skill) => (
              <span key={skill} className="px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3730a3] text-[11px]">{skill}</span>
            ))}
            {(offer.phases || []).slice(0, 2).map((phase) => (
              <span key={phase} className="px-2 py-0.5 rounded-full bg-[#f1f0f7] text-[#464555] text-[11px]">{phase}</span>
            ))}
          </div>
          <p className="text-[12px] text-[#777587] mt-2">
            {offer.hoursPerWeek}h / week
            {offer.builder?.signedTasks ? ` · ${offer.builder.signedTasks} signed` : ""}
            {offer.createdAt ? ` · ${timeAgo(offer.createdAt)}` : ""}
          </p>
        </div>
        <FitBadge score={offer.fitScore} reasons={offer.fitReasons} />
      </div>
    </Link>
  );
}

export default function InboxPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<InboxPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("action");

  const load = async () => {
    if (!token) return;
    const next = await getInbox(token);
    setData(next);
  };

  useEffect(() => {
    if (!token) return;
    load().catch((err) => setError(err.message));
  }, [token]);

  const counts = useMemo(() => {
    if (!data) return null;
    return {
      action: data.summary.actionCount,
      incoming: data.incoming.new.length + data.incoming.tryout.length,
      outgoing: data.outgoing.filter((o) => o.status === "new" || o.status === "tryout").length,
      invites: data.invites.filter((i) => i.status === "pending").length,
      notices: data.summary.unreadNotices,
    };
  }, [data]);

  if (!data) {
    return <div className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading inbox…"}</div>;
  }

  const fullyEmpty = data.summary.actionCount === 0
    && data.incoming.new.length === 0
    && data.incoming.tryout.length === 0
    && data.incoming.decided.length === 0
    && data.outgoing.length === 0
    && data.invites.length === 0
    && data.notices.length === 0;

  return (
    <div className="px-5 py-6 max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Your desk</p>
          <h1 className="font-serif text-[32px] font-semibold">Inbox</h1>
          <p className="text-[13px] text-[#777587] mt-1">
            Offers, invites, day-7 check-ins, and signatures — ranked so the next useful move is on top.
            {data.summary.usingModel ? " Fit scores use Attest's matching model." : " Keyword match while the language model is offline."}
          </p>
        </div>
        {data.summary.unreadNotices > 0 && token && (
          <button
            type="button"
            className="text-[12px] font-semibold text-[#4f46e5]"
            onClick={async () => {
              await markAllNoticesRead(token);
              await load();
            }}
          >
            Mark notices read
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          ["Action items", data.summary.actionCount],
          ["Join requests", data.summary.pendingOffers],
          ["To sign", data.summary.awaitingSignature],
          ["Invites", data.summary.pendingInvites],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white rounded-xl p-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <p className="text-[20px] font-semibold text-[#141b2b]">{value as number}</p>
            <p className="text-[11px] text-[#777587]">{label as string}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              tab === key ? "bg-[#141b2b] text-white" : "text-[#464555] hover:bg-[#f1f0f7]"
            }`}
          >
            {TAB_LABEL[key]}
            {counts && counts[key] > 0 ? ` · ${counts[key]}` : ""}
          </button>
        ))}
      </div>

      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}

      {fullyEmpty && (
        <EmptyState
          title="Nothing waiting yet"
          body="When someone asks to join, invites you, or submits work to sign, it lands here. Post a brief or browse the board to start the loop."
          actionHref="/ideas"
          actionLabel="Browse ideas"
          secondaryHref="/ideas/new"
          secondaryLabel="Post idea"
        />
      )}

      {!fullyEmpty && tab === "action" && (
        <section className="space-y-2">
          {data.actions.length === 0 ? (
            <p className="text-[13px] text-[#777587]">You are caught up. Check Join requests or Your asks for history.</p>
          ) : data.actions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="flex items-start gap-3 bg-white rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_14px_rgba(79,70,229,0.08)] transition-shadow"
            >
              <span className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center text-white text-[16px] material-symbols-outlined ${
                action.type === "day7" ? "bg-[#b45309]"
                  : action.type === "sign" ? "bg-[#15803d]"
                    : action.type === "invite" ? "bg-[#4f46e5]"
                      : "bg-[#3730a3]"
              }`}>
                {action.type === "day7" ? "schedule" : action.type === "sign" ? "verified" : action.type === "invite" ? "mail" : "handshake"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[14px]">{action.title}</p>
                  {action.meta && <span className="text-[11px] font-semibold text-[#4f46e5] shrink-0">{action.meta}</span>}
                </div>
                <p className="text-[13px] text-[#464555] line-clamp-2">{action.body}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {!fullyEmpty && tab === "incoming" && (
        <section>
          {data.incoming.new.length === 0 && data.incoming.tryout.length === 0 && data.incoming.decided.length === 0 && (
            <EmptyState
              title="No join requests yet"
              body="When people ask to collaborate on your ideas or propose an idea on your problems, they show up here ranked by fit."
              actionHref="/ideas/new"
              actionLabel="Post idea"
              secondaryHref="/people"
              secondaryLabel="Invite people"
            />
          )}
          {data.incoming.new.length > 0 && <h2 className="font-semibold text-[14px] mt-2">New · ranked by fit</h2>}
          {data.incoming.new.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          {data.incoming.tryout.length > 0 && <h2 className="font-semibold text-[14px] mt-4">Tryouts</h2>}
          {data.incoming.tryout.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          {data.incoming.decided.length > 0 && <h2 className="font-semibold text-[14px] mt-4">Decided</h2>}
          {data.incoming.decided.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
        </section>
      )}

      {!fullyEmpty && tab === "outgoing" && (
        <section>
          {data.outgoing.length === 0 ? (
            <EmptyState
              title="You have not asked to join yet"
              body="Open an idea with open seats, send a structured offer, and track it here."
              actionHref="/ideas"
              actionLabel="Find an idea"
            />
          ) : data.outgoing.map((offer) => (
            <Link key={offer.id} href={offer.href} className="block bg-white rounded-xl p-4 mt-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-[14px]">{offer.title}</p>
                <span className="text-[11px] uppercase tracking-wider text-[#777587]">{offer.status}</span>
              </div>
              <p className="text-[13px] text-[#464555] mt-1 line-clamp-2">{offer.body}</p>
              <p className="text-[12px] text-[#777587] mt-1">
                {offer.hoursPerWeek}h / week
                {(offer.skills || []).length ? ` · ${(offer.skills || []).slice(0, 3).join(", ")}` : ""}
              </p>
            </Link>
          ))}
        </section>
      )}

      {!fullyEmpty && tab === "invites" && (
        <section>
          {data.invites.length === 0 ? (
            <p className="text-[13px] text-[#777587]">No team invites. People can invite you from your profile.</p>
          ) : data.invites.map((invite) => (
            <Link key={invite.id} href={invite.href} className="block bg-white rounded-xl p-4 mt-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-[14px]">{invite.title}</p>
                <span className="text-[11px] uppercase tracking-wider text-[#777587]">{invite.status}</span>
              </div>
              <p className="text-[12px] text-[#777587] mt-1">{invite.teamStatus.replace("_", " ")} · {timeAgo(invite.createdAt)}</p>
            </Link>
          ))}
        </section>
      )}

      {!fullyEmpty && tab === "notices" && (
        <section>
          {data.signatures.length > 0 && (
            <>
              <h2 className="font-semibold text-[14px]">Waiting for your signature</h2>
              {data.signatures.map((sig) => (
                <Link key={sig.taskId} href={sig.href} className="block bg-white rounded-xl p-4 mt-2 border border-[#dcfce7]">
                  <p className="font-medium text-[14px]">{sig.title}</p>
                  <p className="text-[13px] text-[#464555]">{sig.assigneeName} on {sig.ideaTitle}</p>
                  <p className="text-[12px] font-semibold text-[#15803d] mt-1">Open workspace to sign →</p>
                </Link>
              ))}
            </>
          )}
          <h2 className="font-semibold text-[14px] mt-4">Notices</h2>
          {data.notices.length === 0 && <p className="text-[13px] text-[#777587]">None</p>}
          {data.notices.map((notice) => (
            <div
              key={notice.id}
              className={`rounded-xl p-3 mt-2 text-[13px] ${notice.readAt ? "bg-white border border-[#e4e2ee] text-[#464555]" : "bg-[#eef2ff] border border-[#c7d2fe] text-[#141b2b]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p>{notice.body}</p>
                {!notice.readAt && token && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-[#4f46e5] shrink-0"
                    onClick={async () => {
                      await markNoticeRead(token, notice.id);
                      await load();
                    }}
                  >
                    Read
                  </button>
                )}
              </div>
              {notice.href && (
                <Link href={notice.href} className="inline-block mt-1 text-[12px] text-[#4f46e5] font-semibold hover:underline">
                  {notice.kind === "day7" ? "Open workspace →" : "Open →"}
                </Link>
              )}
            </div>
          ))}
        </section>
      )}

      {user && !fullyEmpty && (
        <p className="text-[11px] text-[#777587] pt-2">
          Tip: structured offers with skills and phases rank higher. No DMs — decisions stay on Attest.
        </p>
      )}
    </div>
  );
}

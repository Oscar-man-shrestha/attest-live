"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getInvite, respondInvite, CampusApiError } from "@/lib/campus-api";
import { Avatar } from "@/components/campus/CommentThread";

export default function InvitePage() {
  const { id } = useParams<{ id: string }>();
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof getInvite>> | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=/invites/${id}`);
  }, [isLoading, user, router, id]);

  useEffect(() => {
    if (!token || !id) return;
    getInvite(token, id).then(setData).catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load invite"));
  }, [token, id]);

  const act = async (action: "accept" | "decline") => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await respondInvite(token, id, action);
      if (action === "accept" && result.ideaId) router.push(`/ideas/${result.ideaId}/work`);
      else router.push("/inbox");
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not respond");
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <div className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading invite…"}</div>;
  }

  const pending = data.invite.status === "pending";

  return (
    <div className="px-5 py-8 max-w-lg mx-auto space-y-4">
      <Link href="/inbox" className="text-[12px] font-medium text-[#777587] hover:text-[#4f46e5]">← Inbox</Link>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Team invite</p>
        <h1 className="font-serif text-[32px] font-semibold mt-1">Join this build?</h1>
        <p className="text-[14px] text-[#464555] mt-1">Accepting adds a seat. A seat is not a receipt — signed work is.</p>
      </div>

      <article className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-3">
        <p className="text-[11px] uppercase tracking-wider text-[#777587]">
          IDEA · {data.idea.seatsOpen ? "OPEN" : "TEAM FULL"} · {data.idea.stage}
        </p>
        <Link href={`/ideas/${data.idea.id}`} className="font-serif text-[22px] font-semibold hover:text-[#4f46e5]">
          {data.idea.title}
        </Link>
        {data.idea.blurb && <p className="text-[14px] text-[#464555]">{data.idea.blurb}</p>}
        {data.idea.helpNeeded.length > 0 && (
          <p className="text-[12px] text-[#777587]">Needs {data.idea.helpNeeded.join(", ")}</p>
        )}
        <p className="text-[12px] text-[#777587]">{data.idea.collaboratorCount}/{((data.idea as { teamMax?: number }).teamMax ?? 6) - 1} seats filled</p>
        {data.owner && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#f1f0f7]">
            <Avatar name={data.owner.displayName} size={32} />
            <div>
              <Link href={`/profile/${data.owner.id}`} className="text-[13px] font-semibold hover:underline">{data.owner.displayName}</Link>
              <p className="text-[11px] text-[#777587]">
                {[data.owner.branch, data.owner.semester ? `Sem ${data.owner.semester}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        )}
      </article>

      {pending ? (
        <div className="flex gap-2">
          <button type="button" disabled={busy || !data.idea.seatsOpen} onClick={() => act("accept")} className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold disabled:opacity-50">
            {busy ? "Working…" : data.idea.seatsOpen ? "Accept seat" : "Team full"}
          </button>
          <button type="button" disabled={busy} onClick={() => act("decline")} className="px-4 py-2 rounded-lg border text-[13px] font-semibold">
            Decline
          </button>
        </div>
      ) : (
        <p className="text-[13px] text-[#464555]">This invite is already {data.invite.status}.</p>
      )}
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
    </div>
  );
}

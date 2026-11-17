"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { BRANCHES } from "@embedra/types";
import {
  addInterest,
  getForYouFeed,
  listSprintIdeas,
  logInteraction,
  type FeedIdea,
  type FeedPage,
  type SprintIdea,
} from "@/lib/campus-api";
import IdeaCard from "@/components/campus/IdeaCard";
import EmptyState from "@/components/campus/EmptyState";
import CampusSwitch, { useCampusScope } from "@/components/campus/CampusSwitch";

type Tab = "for-you" | "latest";

function IdeasBoardInner() {
  const { token, user, isLoading, setCurrentUser } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "latest" ? "latest" : "for-you";
  const initialQ = searchParams.get("q") || "";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [feed, setFeed] = useState<FeedIdea[]>([]);
  const [feedMeta, setFeedMeta] = useState<Omit<FeedPage, "ideas"> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hidden, setHidden] = useState<FeedIdea | null>(null);
  const [ideas, setIdeas] = useState<SprintIdea[]>([]);
  const [shipped, setShipped] = useState<SprintIdea[]>([]);
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [q, setQ] = useState(initialQ);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [scope, setScope] = useCampusScope();

  useEffect(() => {
    const nextTab = searchParams.get("tab") === "latest" ? "latest" : "for-you";
    const nextQ = searchParams.get("q") || "";
    setTab(nextTab);
    setQ(nextQ);
  }, [searchParams]);

  const loadLatest = async (authToken: string) => {
    const params: Record<string, string> = { bucket: "active" };
    if (branch) params.branch = branch;
    if (semester) params.semester = semester;
    if (q) params.q = q;
    if (scope === "campus") params.campus = "1";
    const active = await listSprintIdeas(authToken, params);
    const done = await listSprintIdeas(authToken, { ...params, bucket: "shipped" });
    setIdeas(active.ideas);
    setShipped(done.ideas);
  };

  const loadFeed = async (authToken: string) => {
    const page = await getForYouFeed(authToken, null, scope === "campus");
    const { ideas: rows, ...meta } = page;
    setFeed(rows);
    setFeedMeta(meta);
  };

  useEffect(() => {
    if (!token || tab !== "latest") return;
    setReady(false);
    loadLatest(token)
      .then(() => setReady(true))
      .catch((err) => { setError(err.message); setReady(true); });
  }, [token, tab, branch, semester, q, scope]);

  useEffect(() => {
    if (!token || tab !== "for-you") return;
    setReady(false);
    loadFeed(token)
      .then(() => setReady(true))
      .catch((err) => { setError(err.message); setReady(true); });
  }, [token, tab, scope]);

  if (!isLoading && !user) return null;

  const loadMore = async () => {
    if (!token || !feedMeta?.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await getForYouFeed(token, feedMeta.nextCursor, scope === "campus");
      const seen = new Set(feed.map((row) => row.id));
      setFeed((rows) => [...rows, ...page.ideas.filter((row) => !seen.has(row.id))]);
      setFeedMeta((meta) => (meta ? { ...meta, nextCursor: page.nextCursor } : meta));
    } finally {
      setLoadingMore(false);
    }
  };

  const markSaved = (id: string, saved: boolean) => {
    const flip = <T extends SprintIdea>(rows: T[]) => rows.map((row) => (row.id === id ? { ...row, saved } : row));
    setFeed(flip);
    setIdeas(flip);
    setShipped(flip);
  };

  const notInterested = (idea: FeedIdea) => {
    if (!token) return;
    logInteraction(token, idea.id, "not_interested");
    setFeed((rows) => rows.filter((row) => row.id !== idea.id));
    setHidden(idea);
  };

  const undoHide = () => {
    if (!token || !hidden) return;
    logInteraction(token, hidden.id, "undo_not_interested");
    setFeed((rows) => [hidden, ...rows]);
    setHidden(null);
  };

  const acceptInterest = async (label: string) => {
    if (!token || !user) return;
    try {
      const result = await addInterest(token, label);
      setCurrentUser({ ...user, interests: result.interests });
      setFeedMeta((meta) => (meta ? { ...meta, suggestedInterests: meta.suggestedInterests.filter((item) => item !== label) } : meta));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the interest");
    }
  };

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => { setTab(value); setError(null); }}
      className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${tab === value ? "bg-[#141b2b] text-white" : "text-[#464555] hover:bg-[#f1f0f7]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="px-5 sm:px-8 py-6 max-w-5xl 2xl:max-w-7xl mx-auto space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="serial text-[#4f46e5]">Ideas · builds seeking teammates</p>
          <h1 className="font-serif text-[34px] sm:text-[40px] font-semibold tracking-tight">What students are <span className="hl-indigo">building</span></h1>
          <p className="text-[14px] text-[#777587] mt-1">Paid, sponsored, open source or for credit. Switch between your campus and every campus.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Link href="/ideas/new" className="px-3.5 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold transition-transform active:scale-[0.98]">Post idea</Link>
          <Link href="/problems/new" className="px-3.5 py-2 rounded-lg border border-[#b45309]/40 text-[#b45309] text-[13px] font-semibold hover:bg-[#fffbf5] transition-colors">Report a problem</Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-[13px]">
        <div className="rounded-xl bg-white border border-[#eceaf4] p-3.5">
          <p className="font-semibold text-[#141b2b]">Ask to join</p>
          <p className="text-[#777587] mt-0.5">Tell the owner what you will own. They accept → you unlock the full brief.</p>
        </div>
        <div className="rounded-xl bg-white border border-[#eceaf4] p-3.5">
          <p className="font-semibold text-[#141b2b]">Start my version</p>
          <p className="text-[#777587] mt-0.5">Remix the public slice into your own idea with credit. Private notes never copy.</p>
        </div>
        <div className="rounded-xl bg-white border border-[#eceaf4] p-3.5">
          <p className="font-semibold text-[#141b2b]">Like · comment · save</p>
          <p className="text-[#777587] mt-0.5">Social signals only. Signed workspace tasks are the real proof.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {tabButton("for-you", "For you")}
          {tabButton("latest", "Latest")}
        </div>
        <CampusSwitch value={scope} onChange={setScope} />
      </div>

      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}

      {tab === "for-you" && (
        <>
          {user && !(user.interests?.length) && (
            <Link href="/profile" className="block rounded-xl border border-dashed border-[#c7c4d8] bg-[#f8f9ff] p-4 text-[13px] text-[#464555] hover:bg-white transition-colors">
              Pick your interests and skills so this feed fits you. It also learns from what you open, read, and save.
            </Link>
          )}
          {feedMeta && feedMeta.suggestedInterests.length > 0 && (
            <div className="rounded-xl bg-[#f6f5fc] border border-[#e3e1f1] p-3">
              <p className="text-[12px] text-[#464555]">You keep reading about these. Add them to your interests?</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {feedMeta.suggestedInterests.map((label) => (
                  <button key={label} type="button" onClick={() => acceptInterest(label)} className="px-3 py-1 rounded-full text-[12px] border border-[#4f46e5] text-[#4f46e5] hover:bg-[#4f46e5] hover:text-white transition-colors">
                    + {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hidden && (
            <div className="flex items-center justify-between rounded-lg bg-[#141b2b] text-white px-3 py-2 text-[13px]">
              <span>Hidden. You will see fewer ideas like this.</span>
              <button type="button" onClick={undoHide} className="font-semibold">Undo</button>
            </div>
          )}
          {!ready && <p className="text-[13px] text-[#777587]">Finding ideas for you…</p>}
          {ready && feed.length === 0 && (
            <EmptyState
              title="No picks for your profile yet"
              body="Browse Latest for every open brief, or post your own. Ask to join a team — or Start my version to remix a public brief into yours."
              onAction={() => { setTab("latest"); setError(null); }}
              actionLabel="See latest ideas"
              secondaryHref="/ideas/new"
              secondaryLabel="Post idea"
            />
          )}
          <div className="space-y-4">
            {feed.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                token={token}
                viewerId={user?.id}
                feedCard
                onNotInterested={() => notInterested(idea)}
                onSavedChange={(saved) => markSaved(idea.id, saved)}
              />
            ))}
          </div>
          {feedMeta?.nextCursor && (
            <button type="button" onClick={loadMore} disabled={loadingMore} className="w-full py-2.5 rounded-lg border border-[#c7c4d8] text-[13px] font-medium hover:bg-white transition-colors disabled:opacity-60">
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          )}
          {feedMeta && !feedMeta.usingModel && feed.length > 0 && (
            <p className="text-[11px] text-[#777587]">Ranking by keywords while the language model is offline.</p>
          )}
        </>
      )}

      {tab === "latest" && (
        <>
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && token) loadLatest(token).catch((err) => setError(err.message)); }} placeholder="Search by title" className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px] bg-white min-w-[200px]" />
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px] bg-white">
              <option value="">All branches</option>
              {BRANCHES.map((code) => <option key={code}>{code}</option>)}
            </select>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px] bg-white">
              <option value="">All semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {!ready && <p className="text-[13px] text-[#777587]">Loading latest…</p>}
          {ready && ideas.length === 0 && (
            <EmptyState
              title={branch || semester || q ? "No ideas match these filters" : "No sprint ideas posted yet"}
              body={branch || semester || q
                ? "Clear your filters or post the first brief for this branch."
                : "Post a brief with what you need. Builders can Ask to join or Start my version."}
              onAction={branch || semester || q ? () => { setBranch(""); setSemester(""); setQ(""); } : undefined}
              actionLabel={branch || semester || q ? "Reset filters" : "Post an idea"}
              actionHref={!(branch || semester || q) ? "/ideas/new" : undefined}
              secondaryHref={branch || semester || q ? "/ideas/new" : "/problems/new"}
              secondaryLabel={branch || semester || q ? "Post an idea" : "Report a problem"}
            />
          )}
          <div className="space-y-4">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                token={token}
                viewerId={user?.id}
                onSavedChange={(saved) => markSaved(idea.id, saved)}
              />
            ))}
          </div>
          {shipped.length > 0 && <h2 className="font-serif text-[24px] pt-4">Shipped</h2>}
          <div className="space-y-4">
            {shipped.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                token={token}
                viewerId={user?.id}
                onSavedChange={(saved) => markSaved(idea.id, saved)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function IdeasBoardPage() {
  return (
    <Suspense fallback={<div className="px-5 py-10 text-[14px] text-[#777587]">Loading ideas…</div>}>
      <IdeasBoardInner />
    </Suspense>
  );
}

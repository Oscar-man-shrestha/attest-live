"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { listSavedIdeas, saveCard, type SprintIdea, type SprintProblem, CampusApiError } from "@/lib/campus-api";
import IdeaCard from "@/components/campus/IdeaCard";
import EmptyState from "@/components/campus/EmptyState";

export default function SavedPage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [ideas, setIdeas] = useState<SprintIdea[]>([]);
  const [problems, setProblems] = useState<SprintProblem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/saved");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    listSavedIdeas(token)
      .then((page) => {
        setIdeas(page.ideas);
        setProblems(page.problems || []);
        setCursor(page.nextCursor);
      })
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load saved items"))
      .finally(() => setLoading(false));
  }, [token]);

  const more = async () => {
    if (!token || !cursor) return;
    const page = await listSavedIdeas(token, cursor);
    setIdeas((rows) => [...rows, ...page.ideas.filter((idea) => !rows.some((row) => row.id === idea.id))]);
    setCursor(page.nextCursor);
  };

  const total = ideas.length + problems.length;

  return (
    <div className="px-5 sm:px-8 py-6 max-w-5xl 2xl:max-w-7xl mx-auto space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Bookmarks</p>
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-serif text-[34px] sm:text-[40px] font-semibold tracking-tight">Saved</h1>
          {!loading && total > 0 && (
            <span className="text-[14px] font-medium text-[#777587]">({total})</span>
          )}
        </div>
        <p className="text-[14px] text-[#464555] mt-1">Ideas and problems you bookmarked — same cards as the Ideas board.</p>
      </div>
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {loading && (
        <div className="space-y-3">
          <div className="h-40 rounded-2xl bg-white border border-[#e4e2ee] animate-pulse" />
          <div className="h-40 rounded-2xl bg-white border border-[#e4e2ee] animate-pulse" />
        </div>
      )}
      {!loading && total === 0 && (
        <EmptyState
          title="Nothing saved yet"
          body="Tap Save on an idea while you browse. Come back to Ask to join or Start my version when you have time."
          actionHref="/ideas"
          actionLabel="Browse ideas"
          secondaryHref="/problems"
          secondaryLabel="Browse problems"
        />
      )}

      {problems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">Problems</h2>
          {problems.map((problem) => (
            <article
              key={problem.id}
              className="bg-white rounded-2xl p-5 border border-[#f3e6d4]/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-[#b45309] font-semibold">
                    {problem.hasIdea ? "PROBLEM · HAS IDEA" : "PROBLEM · NEEDS IDEA"}
                  </p>
                  <Link
                    href={`/problems/${problem.id}`}
                    className="font-serif text-[24px] font-semibold text-[#141b2b] hover:text-[#b45309] transition-colors"
                  >
                    {problem.title}
                  </Link>
                  <p className="text-[15px] text-[#464555] mt-1 line-clamp-3">{problem.whatHappens}</p>
                  <Link href={`/problems/${problem.id}`} className="inline-flex mt-3 text-[13px] font-semibold text-[#b45309]">
                    {problem.hasIdea ? "Open problem →" : "Propose an idea →"}
                  </Link>
                </div>
                {token && (
                  <button
                    type="button"
                    className="shrink-0 px-3 py-1.5 h-fit rounded-lg border border-[#b45309] bg-[#fff7ed] text-[#b45309] text-[12px] font-semibold"
                    onClick={async () => {
                      await saveCard(token, "problem", problem.id, false);
                      setProblems((rows) => rows.filter((row) => row.id !== problem.id));
                    }}
                  >
                    Unsave
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {ideas.length > 0 && (
        <section className="space-y-4">
          {problems.length > 0 && (
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Ideas</h2>
          )}
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              token={token}
              viewerId={user?.id}
              onSavedChange={(saved) => {
                if (!saved) setIdeas((rows) => rows.filter((row) => row.id !== idea.id));
              }}
            />
          ))}
        </section>
      )}
      {cursor && (
        <button type="button" onClick={() => more().catch(() => undefined)} className="w-full py-2.5 rounded-lg border border-[#c7c4d8] text-[13px] font-medium">
          Show more ideas
        </button>
      )}
    </div>
  );
}

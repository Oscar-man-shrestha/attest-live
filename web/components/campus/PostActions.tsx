"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { forkIdea, recordShare, saveCard, setLike, CampusApiError, type Engagement } from "@/lib/campus-api";
import CommentThread from "./CommentThread";

type Props = {
  token: string;
  idea: {
    id: string;
    title: string;
    pitch: string | null;
    ownerId: string | null;
    saved: boolean;
    forkCount?: number;
    engagement?: Engagement;
  };
  viewerId?: string;
  /** Opens the comment thread without a click, for the idea page. */
  commentsOpen?: boolean;
  /** Hide the likes/comments line when the parent card already shows it. */
  hideSummary?: boolean;
  onSavedChange?: (saved: boolean) => void;
};

const EMPTY: Engagement = { likes: 0, liked: false, comments: 0, shares: 0 };

function Icon({ path, filled = false }: { path: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

const HEART = "M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z";
const BUBBLE = "M4 5.5h16v10.5H9l-5 4V5.5z";
const SHARE = "M12 3v12M7 8l5-5 5 5M5 14v5h14v-5";
const BOOKMARK = "M6 3.5h12v17l-6-4-6 4v-17z";
const FORK = "M6 3v12M18 9v12M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 12h6";

export default function PostActions({ token, idea, viewerId, commentsOpen = false, hideSummary = false, onSavedChange }: Props) {
  const router = useRouter();
  const [stats, setStats] = useState<Engagement>(idea.engagement ?? EMPTY);
  const [saved, setSaved] = useState(idea.saved);
  const [forks, setForks] = useState(idea.forkCount ?? 0);
  const [forking, setForking] = useState(false);
  const [open, setOpen] = useState(commentsOpen);
  const [note, setNote] = useState<string | null>(null);
  const own = viewerId === idea.ownerId;

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote(null), 2500);
  };

  const toggleLike = async () => {
    if (own) return flash("You cannot like your own idea");
    const next = !stats.liked;
    setStats((s) => ({ ...s, liked: next, likes: s.likes + (next ? 1 : -1) }));
    try {
      const result = await setLike(token, "idea", idea.id, next);
      setStats((s) => ({ ...s, liked: result.liked, likes: result.likes }));
    } catch (err) {
      setStats((s) => ({ ...s, liked: !next, likes: s.likes + (next ? -1 : 1) }));
      flash(err instanceof CampusApiError ? err.message : "Could not like");
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/ideas/${idea.id}`;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: idea.title, text: idea.pitch ?? idea.title, url });
        shared = true;
      } else {
        await navigator.clipboard.writeText(url);
        shared = true;
        flash("Link copied");
      }
    } catch {
      return;
    }
    if (shared) {
      const result = await recordShare(token, idea.id).catch(() => null);
      if (result) setStats((s) => ({ ...s, shares: result.shares }));
    }
  };

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await saveCard(token, "idea", idea.id, next);
      onSavedChange?.(next);
    } catch {
      setSaved(!next);
    }
  };

  const fork = async () => {
    if (forking) return;
    setForking(true);
    try {
      const result = await forkIdea(token, idea.id);
      setForks((n) => n + 1);
      router.push(`/ideas/${result.idea.id}`);
    } catch (err) {
      flash(err instanceof CampusApiError ? err.message : "Could not fork");
      setForking(false);
    }
  };

  const buttonBase = "min-h-[40px] px-2 sm:px-3 py-1.5 rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors";
  const summary = [
    stats.likes ? `${stats.likes} ${stats.likes === 1 ? "like" : "likes"}` : null,
    stats.comments ? `${stats.comments} ${stats.comments === 1 ? "comment" : "comments"}` : null,
    stats.shares ? `${stats.shares} ${stats.shares === 1 ? "share" : "shares"}` : null,
    forks ? `${forks} ${forks === 1 ? "remix" : "remixes"}` : null,
  ].filter(Boolean);

  return (
    <div className="mt-3">
      {!hideSummary && summary.length > 0 && (
        <button type="button" onClick={() => setOpen(true)} className="w-full text-left text-[12px] text-[#777587] pb-1.5 hover:underline">
          {summary.join(" · ")}
        </button>
      )}
      <div className="flex items-center justify-between border-t border-[#eceaf4] pt-1.5 gap-1.5">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={stats.liked}
            aria-label={stats.liked ? "Unlike idea" : "Like idea"}
            className={`${buttonBase} ${stats.liked ? "text-[#e11d48] bg-[#ffe4e6]/40" : "text-[#464555] hover:bg-[#f4f3f9]"} ${own ? "opacity-50" : ""}`}
          >
            <Icon path={HEART} filled={stats.liked} />
            <span className="text-[12px] sm:text-[13px]">
              {stats.likes > 0 ? stats.likes : (stats.liked ? "Liked" : "Like")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Comment on idea"
            className={`${buttonBase} ${open ? "text-[#4f46e5] bg-[#eef2ff]" : "text-[#464555] hover:bg-[#f4f3f9]"}`}
          >
            <Icon path={BUBBLE} />
            <span className="hidden sm:inline">Comment</span>
            {stats.comments > 0 && <span className="text-[12px] sm:text-[13px]">{stats.comments}</span>}
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="Share idea"
            className={`${buttonBase} text-[#464555] hover:bg-[#f4f3f9]`}
          >
            <Icon path={SHARE} />
            <span className="hidden sm:inline">Share</span>
            {stats.shares > 0 && <span className="text-[12px] sm:text-[13px]">{stats.shares}</span>}
          </button>
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            aria-label={saved ? "Unsave idea" : "Save idea"}
            className={`${buttonBase} ${saved ? "text-[#4f46e5] bg-[#eef2ff]" : "text-[#464555] hover:bg-[#f4f3f9]"}`}
          >
            <Icon path={BOOKMARK} filled={saved} />
            <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
          </button>
        </div>
        <button
          type="button"
          onClick={fork}
          disabled={forking}
          className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#c7c4d8]/80 bg-[#f8f9ff] hover:bg-[#eef2ff] hover:border-[#4f46e5]/40 text-[#141b2b] text-[12px] font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98] shrink-0 disabled:opacity-50"
          aria-label="Start my version of this idea"
          title="Start your own related idea with credit. Copies only the public slice — never private notes."
        >
          <Icon path={FORK} />
          <span className="hidden sm:inline">{forking ? "Starting…" : "Start my version"}</span>
          <span className="sm:hidden">{forking ? "…" : "Remix"}</span>
          {forks > 0 && <span className="text-[11px] font-normal text-[#777587]">({forks})</span>}
        </button>
      </div>
      {note && <p className="text-[12px] text-[#4f46e5] mt-1">{note}</p>}
      {open && (
        <div className="mt-3">
          <CommentThread
            token={token}
            ideaId={idea.id}
            autoFocus={!commentsOpen}
            onCountChange={(delta) => setStats((s) => ({ ...s, comments: Math.max(0, s.comments + delta) }))}
          />
        </div>
      )}
    </div>
  );
}

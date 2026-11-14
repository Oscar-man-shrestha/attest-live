"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteComment,
  listComments,
  listReplies,
  postComment,
  setLike,
  CampusApiError,
  type SprintComment,
} from "@/lib/campus-api";

export function timeAgo(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(value).toLocaleDateString();
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

export function Avatar({ name, size = 32, src }: { name: string; size?: number; src?: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0 bg-[#e0e7ff]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[#e0e7ff] text-[#3730a3] font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

type Props = {
  token: string;
  ideaId: string;
  /** Called with +1 or -1 when a visible comment is added or removed, to keep the card count live. */
  onCountChange?: (delta: number) => void;
  autoFocus?: boolean;
};

function Composer({ onSubmit, placeholder, autoFocus, initial = "" }: { onSubmit: (body: string) => Promise<void>; placeholder: string; autoFocus?: boolean; initial?: string }) {
  const [body, setBody] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex-1"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        setError(null);
        try {
          await onSubmit(body.trim());
          setBody("");
        } catch (err) {
          setError(err instanceof CampusApiError ? err.message : "Could not post");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex gap-2">
        <textarea
          value={body}
          autoFocus={autoFocus}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); }}
          rows={1}
          maxLength={2000}
          placeholder={placeholder}
          className="flex-1 resize-y min-h-[38px] rounded-2xl border border-[#c7c4d8] px-3 py-2 text-[13px]"
        />
        <button disabled={busy || !body.trim()} className="px-3 rounded-full bg-[#4f46e5] text-white text-[12px] font-semibold disabled:opacity-40">
          {busy ? "…" : "Post"}
        </button>
      </div>
      {error && <p className="text-[12px] text-[#ba1a1a] mt-1">{error}</p>}
    </form>
  );
}

function CommentItem({
  token,
  comment,
  onReply,
  onDeleted,
  isReply = false,
}: {
  token: string;
  comment: SprintComment;
  onReply: (to: SprintComment) => void;
  onDeleted: (comment: SprintComment) => void;
  isReply?: boolean;
}) {
  const [liked, setLiked] = useState(comment.liked);
  const [likes, setLikes] = useState(comment.likes);
  const [error, setError] = useState<string | null>(null);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      const result = await setLike(token, "comment", comment.id, next);
      setLikes(result.likes);
    } catch (err) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      setError(err instanceof CampusApiError ? err.message : "Could not like");
    }
  };

  const name = comment.author.name;
  return (
    <div className="flex gap-2">
      <Avatar name={name} size={isReply ? 26 : 32} />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-[#f4f3f9] px-3 py-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {comment.author.id ? (
              <Link href={`/profile/${comment.author.id}`} className="text-[13px] font-semibold hover:underline">{name}</Link>
            ) : (
              <span className="text-[13px] font-semibold">{name}</span>
            )}
            {comment.author.isIdeaAuthor && <span className="text-[10px] font-semibold px-1.5 rounded bg-[#4f46e5] text-white">Author</span>}
            <span className="text-[11px] text-[#777587]">
              {[comment.author.branch, comment.author.semester ? `Sem ${comment.author.semester}` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
          {comment.author.headline && <p className="text-[11px] text-[#777587] truncate">{comment.author.headline}</p>}
          <p className={`text-[13px] mt-0.5 whitespace-pre-wrap break-words ${comment.deleted ? "italic text-[#777587]" : "text-[#1f2433]"}`}>
            {comment.deleted ? "Comment deleted" : comment.body}
          </p>
        </div>
        <div className="flex items-center gap-3 px-2 mt-0.5 text-[11px] text-[#777587]">
          <span>{timeAgo(comment.createdAt)}</span>
          {!comment.deleted && !comment.mine && (
            <button type="button" onClick={toggleLike} className={liked ? "font-semibold text-[#4f46e5]" : "hover:text-[#4f46e5]"}>
              {liked ? "Liked" : "Like"}
            </button>
          )}
          {likes > 0 && <span>♥ {likes}</span>}
          {!comment.deleted && <button type="button" onClick={() => onReply(comment)} className="hover:text-[#4f46e5]">Reply</button>}
          {comment.canDelete && (
            <button
              type="button"
              className="hover:text-[#ba1a1a]"
              onClick={async () => {
                if (!window.confirm("Delete this comment?")) return;
                try {
                  await deleteComment(token, comment.id);
                  onDeleted(comment);
                } catch (err) {
                  setError(err instanceof CampusApiError ? err.message : "Could not delete");
                }
              }}
            >
              Delete
            </button>
          )}
        </div>
        {error && <p className="text-[11px] text-[#ba1a1a] px-2">{error}</p>}
      </div>
    </div>
  );
}

function Thread({ token, ideaId, root, onCountChange, onRootDeleted }: {
  token: string;
  ideaId: string;
  root: SprintComment;
  onCountChange?: (delta: number) => void;
  onRootDeleted: (root: SprintComment) => void;
}) {
  const [replies, setReplies] = useState<SprintComment[]>(root.replies ?? []);
  const [replyCount, setReplyCount] = useState(root.replyCount);
  const [cursor, setCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [replyTo, setReplyTo] = useState<SprintComment | null>(null);
  const [deleted, setDeleted] = useState(root.deleted);

  const loadAll = async () => {
    const page = await listReplies(token, root.id, expanded ? cursor : null);
    setReplies((current) => {
      const base = expanded ? current : [];
      const seen = new Set(base.map((r) => r.id));
      return [...base, ...page.replies.filter((r) => !seen.has(r.id))];
    });
    setCursor(page.nextCursor);
    setExpanded(true);
  };

  const hidden = expanded ? (cursor ? 1 : 0) : Math.max(0, replyCount - replies.length);

  return (
    <div className="space-y-2">
      <CommentItem
        token={token}
        comment={{ ...root, deleted, body: deleted ? null : root.body, canDelete: root.canDelete && !deleted }}
        onReply={setReplyTo}
        onDeleted={() => {
          onCountChange?.(-1);
          if (replyCount > 0) setDeleted(true);
          else onRootDeleted(root);
        }}
      />
      <div className="pl-10 space-y-2">
        {replies.map((reply) => (
          <CommentItem
            key={reply.id}
            token={token}
            comment={reply}
            isReply
            onReply={setReplyTo}
            onDeleted={(gone) => {
              setReplies((list) => list.filter((r) => r.id !== gone.id));
              setReplyCount((n) => n - 1);
              onCountChange?.(-1);
            }}
          />
        ))}
        {hidden > 0 && (
          <button type="button" onClick={() => loadAll().catch(() => undefined)} className="text-[12px] font-semibold text-[#4f46e5]">
            {expanded ? "Load more replies" : `View ${hidden} more ${hidden === 1 ? "reply" : "replies"}`}
          </button>
        )}
        {replyTo && (
          <Composer
            autoFocus
            key={replyTo.id}
            initial={replyTo.id !== root.id ? `@${replyTo.author.name} ` : ""}
            placeholder={`Reply to ${replyTo.author.name}`}
            onSubmit={async (body) => {
              const { comment } = await postComment(token, ideaId, body, replyTo.id);
              setReplies((list) => [...list, comment]);
              setReplyCount((n) => n + 1);
              setReplyTo(null);
              onCountChange?.(1);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function CommentThread({ token, ideaId, onCountChange, autoFocus }: Props) {
  const [sort, setSort] = useState<"top" | "new">("top");
  const [comments, setComments] = useState<SprintComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoaded(false);
    listComments(token, ideaId, sort)
      .then((page) => {
        if (!live) return;
        setComments(page.comments);
        setCursor(page.nextCursor);
        setLoaded(true);
      })
      .catch((err) => live && setError(err instanceof CampusApiError ? err.message : "Could not load comments"));
    return () => { live = false; };
  }, [token, ideaId, sort]);

  const more = async () => {
    if (!cursor) return;
    const page = await listComments(token, ideaId, sort, cursor);
    setComments((list) => {
      const seen = new Set(list.map((c) => c.id));
      return [...list, ...page.comments.filter((c) => !seen.has(c.id))];
    });
    setCursor(page.nextCursor);
  };

  return (
    <div className="space-y-3">
      <Composer
        autoFocus={autoFocus}
        placeholder="Add a comment…"
        onSubmit={async (body) => {
          const { comment } = await postComment(token, ideaId, body);
          setComments((list) => [comment, ...list]);
          onCountChange?.(1);
        }}
      />
      {comments.length > 1 && (
        <div className="flex gap-2 text-[12px]">
          {(["top", "new"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setSort(value)} className={sort === value ? "font-semibold text-[#141b2b]" : "text-[#777587]"}>
              {value === "top" ? "Most relevant" : "Newest"}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[12px] text-[#ba1a1a]">{error}</p>}
      {loaded && comments.length === 0 && <p className="text-[12px] text-[#777587]">No comments yet. Start the conversation.</p>}
      {comments.map((comment) => (
        <Thread
          key={comment.id}
          token={token}
          ideaId={ideaId}
          root={comment}
          onCountChange={onCountChange}
          onRootDeleted={(gone) => setComments((list) => list.filter((c) => c.id !== gone.id))}
        />
      ))}
      {cursor && (
        <button type="button" onClick={() => more().catch(() => undefined)} className="text-[12px] font-semibold text-[#4f46e5]">Load more comments</button>
      )}
    </div>
  );
}

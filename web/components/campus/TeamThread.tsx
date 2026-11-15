"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CampusApiError, listTeamMessages, postTeamMessage, type TeamMessage } from "@/lib/campus-api";

/** Team thread: only the owner and active team members can read or write. Refreshes every 20 seconds. */
export default function TeamThread({ token, ideaId }: { token: string; ideaId: string }) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [members, setMembers] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listTeamMessages(token, ideaId)
      .then((page) => {
        // Keep older pages the reader already loaded; replace the newest page.
        setMessages((list) => {
          const fresh = new Set(page.messages.map((m) => m.id));
          return [...page.messages, ...list.filter((m) => !fresh.has(m.id))];
        });
        setCursor((current) => current ?? page.nextCursor);
        setMembers(page.memberCount);
      })
      .catch(() => undefined);
  }, [token, ideaId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await postTeamMessage(token, ideaId, text);
      setMessages((list) => [result.message, ...list]);
      setBody("");
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  const older = async () => {
    if (!cursor) return;
    const page = await listTeamMessages(token, ideaId, cursor);
    setMessages((list) => {
      const seen = new Set(list.map((m) => m.id));
      return [...list, ...page.messages.filter((m) => !seen.has(m.id))];
    });
    setCursor(page.nextCursor);
  };

  return (
    <section className="rounded-2xl border border-[#c7c4d8] bg-white p-5 shadow-sm space-y-3" aria-labelledby="team-thread-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#e5e7eb] pb-3">
        <h2 id="team-thread-heading" className="font-serif text-[20px] font-semibold text-[#141b2b]">Team thread</h2>
        <span className="serial">{members} on the team · private</span>
      </div>
      <p className="text-[12px] text-[#777587]">Only the owner and current teammates can read this. Anyone who leaves the team loses access.</p>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Message your team"
          aria-label="Message your team"
          className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
        />
        <button type="submit" disabled={busy || !body.trim()} className="px-4 py-2 rounded-lg bg-[#141b2b] text-white text-[13px] font-semibold disabled:opacity-50">
          Send
        </button>
      </form>
      {error && <p className="text-[12px] text-[#ba1a1a]">{error}</p>}
      {messages.length === 0 && <p className="text-[13px] text-[#777587]">No messages yet. Say when you&apos;re free this week.</p>}
      <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] ${m.mine ? "ml-auto bg-[#eef0ff] text-[#1e1b4b]" : "bg-[#f5f5f4] text-[#1c1917]"}`}>
            <p className="text-[11px] font-semibold opacity-70">
              {m.mine ? "You" : m.name}
              {m.isOwner ? " · owner" : ""}
              {m.former ? " · left the team" : ""}
              {" · "}
              {new Date(m.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
          </li>
        ))}
      </ul>
      {cursor && <button type="button" onClick={older} className="text-[12px] text-[#4f46e5]">Older messages</button>}
    </section>
  );
}

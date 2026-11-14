"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSprintIdea, CampusApiError } from "@/lib/campus-api";
import SprintIdeaView from "@/components/campus/SprintIdeaView";

/**
 * Campus idea detail. Sprint cards only — no legacy Embedra fallback.
 */
export default function ViewIdeaPage() {
  const params = useParams();
  const ideaId = params?.id as string;
  const { token, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!ideaId || authLoading) return;
    if (!token) {
      setStatus("missing");
      setMessage("Sign in to read this idea.");
      return;
    }
    let live = true;
    setStatus("loading");
    getSprintIdea(token, ideaId)
      .then(() => {
        if (live) setStatus("ok");
      })
      .catch((err) => {
        if (!live) return;
        setStatus("missing");
        setMessage(err instanceof CampusApiError ? err.message : "That idea could not be loaded.");
      });
    return () => {
      live = false;
    };
  }, [ideaId, token, authLoading]);

  if (status === "ok") return <SprintIdeaView ideaId={ideaId} />;

  if (status === "loading" || authLoading) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-10">
        <p className="text-[14px] text-[#777587]">Loading idea…</p>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-5 py-16 text-center space-y-4">
      <h1 className="font-serif text-[28px] font-semibold text-[#141b2b]">Idea not found</h1>
      <p className="text-[14px] text-[#464555]">{message || "This idea is missing or no longer on the board."}</p>
      <Link href="/ideas" className="inline-flex text-[13px] font-semibold text-[#4f46e5]">
        Back to the feed
      </Link>
    </main>
  );
}

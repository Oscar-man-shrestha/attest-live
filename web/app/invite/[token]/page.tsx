"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { joinViaInvite, ApiError } from "@/lib/api";

type State = "idle" | "joining" | "success" | "error" | "needs-auth";

interface JoinResult {
  ideaId: string;
  groupId: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const inviteToken = params?.token as string;

  const [state, setState] = useState<State>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!inviteToken) {
      setState("error");
      setErrorMessage("Invalid invite link — no token found.");
      return;
    }
    if (!user || !token) {
      setState("needs-auth");
      return;
    }

    const attemptJoin = async () => {
      setState("joining");
      try {
        const res = await joinViaInvite(inviteToken, token);
        setJoinResult({ ideaId: res.ideaId, groupId: res.groupId });
        setState("success");
        setTimeout(() => router.push(`/ideas/${res.ideaId}`), 2500);
      } catch (err: unknown) {
        setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
        setState("error");
      }
    };

    attemptJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, token, inviteToken]);

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-5">
      <div className="w-full max-w-md bg-white rounded-xl p-8 space-y-5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#e4e2ee]">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Team invite</p>

        {(state === "idle" || authLoading) && (
          <>
            <h1 className="font-serif text-[28px] font-semibold text-[#141b2b]">Preparing your invite…</h1>
            <p className="text-[13px] text-[#777587]">Hang on a moment.</p>
          </>
        )}

        {state === "joining" && (
          <>
            <h1 className="font-serif text-[28px] font-semibold text-[#141b2b]">Joining the team…</h1>
            <p className="text-[13px] text-[#777587]">You will open the idea workspace next.</p>
          </>
        )}

        {state === "success" && (
          <>
            <h1 className="font-serif text-[28px] font-semibold text-[#141b2b]">You are on the team</h1>
            <p className="text-[13px] text-[#777587]">Redirecting to the idea…</p>
            {joinResult && (
              <Link
                href={`/ideas/${joinResult.ideaId}`}
                className="inline-flex px-4 py-2.5 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold"
              >
                Go to idea now
              </Link>
            )}
          </>
        )}

        {state === "needs-auth" && (
          <>
            <h1 className="font-serif text-[28px] font-semibold text-[#141b2b]">Log in to accept</h1>
            <p className="text-[13px] text-[#777587]">
              Use your campus Outlook. This invite still works after you sign in.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href={`/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}`}
                className="inline-flex px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold"
              >
                Sign in
              </Link>
              <Link href="/" className="text-[13px] text-[#777587] hover:text-[#4f46e5]">
                Back home
              </Link>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="font-serif text-[28px] font-semibold text-[#141b2b]">Could not join</h1>
            <p className="text-[13px] text-[#777587]">{errorMessage}</p>
            <Link href="/ideas" className="inline-flex px-4 py-2 rounded-lg border border-[#c7c4d8] text-[13px] font-semibold text-[#141b2b]">
              Browse ideas
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

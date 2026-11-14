"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, MICROSOFT_STATE_KEY } from "@/lib/campus-api";

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const { finishMicrosoft } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const microsoftError = params.get("error_description") || params.get("error");
    const code = params.get("code");
    const state = params.get("state");
    const expected = sessionStorage.getItem(MICROSOFT_STATE_KEY);
    sessionStorage.removeItem(MICROSOFT_STATE_KEY);

    if (microsoftError) {
      setError(/AADSTS65001|admin|consent/i.test(microsoftError)
        ? "Your college has to approve Attest before students can sign in with Outlook. Use the email code for now."
        : "Microsoft did not finish the sign-in. Try again.");
      return;
    }
    if (!code || !state || !expected || state !== expected) {
      setError("The sign-in link expired. Start again.");
      return;
    }

    finishMicrosoft(code, state)
      .then(({ profileComplete, next }) => {
        router.replace(profileComplete ? next || "/ideas" : "/profile");
      })
      .catch((err) => {
        setError(err instanceof CampusApiError ? err.message : "Sign-in failed. Try again.");
      });
  }, [params, finishMicrosoft, router]);

  return (
    <div className="px-5 py-16 max-w-md mx-auto text-center">
      {error ? (
        <>
          <h1 className="font-serif text-[26px] font-semibold text-[#141b2b]">Sign-in did not finish</h1>
          <p className="text-[14px] text-[#ba1a1a] mt-3">{error}</p>
          <Link href="/login" className="inline-block mt-6 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold px-4 py-2.5">
            Back to sign in
          </Link>
        </>
      ) : (
        <p className="text-[14px] text-[#464555]">Signing you in…</p>
      )}
    </div>
  );
}

export default function MicrosoftCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, GOOGLE_STATE_KEY, MICROSOFT_STATE_KEY } from "@/lib/campus-api";

/** Finishes a Google or Microsoft sign-in after the provider redirects back with ?code=&state=. */
export default function OAuthCallback({ provider }: { provider: "google" | "microsoft" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { finishMicrosoft, finishGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const label = provider === "google" ? "Google" : "Microsoft";

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const key = provider === "google" ? GOOGLE_STATE_KEY : MICROSOFT_STATE_KEY;
    const providerError = params.get("error_description") || params.get("error");
    const code = params.get("code");
    const state = params.get("state");
    const expected = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);

    if (providerError) {
      if (provider === "microsoft" && /AADSTS65001|admin|consent/i.test(providerError)) {
        setError("Your college has to approve Attest before students can sign in with Outlook. Use the email code for now.");
      } else if (/access_denied/i.test(providerError)) {
        setError(`You cancelled the ${label} sign-in. Nothing was shared.`);
      } else {
        setError(`${label} did not finish the sign-in. Try again.`);
      }
      return;
    }
    if (!code || !state || !expected || state !== expected) {
      setError("The sign-in link expired. Start again.");
      return;
    }

    (provider === "google" ? finishGoogle : finishMicrosoft)(code, state)
      .then(({ profileComplete, next }) => {
        router.replace(profileComplete ? next || "/ideas" : "/profile");
      })
      .catch((err) => {
        setError(err instanceof CampusApiError ? err.message : "Sign-in failed. Try again.");
      });
  }, [params, provider, label, finishMicrosoft, finishGoogle, router]);

  return (
    <div className="paper-grid min-h-[calc(100vh-4rem)] px-5 py-16">
      <div className="mx-auto max-w-md text-center">
        {error ? (
          <>
            <h1 className="font-serif text-[26px] font-semibold text-[#141b2b]">Sign-in did not finish</h1>
            <p className="text-[14px] text-[#ba1a1a] mt-3">{error}</p>
            <Link href="/login" className="inline-block mt-6 rounded-lg bg-[#141b2b] text-white text-[13px] font-semibold px-4 py-2.5">
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-[14px] text-[#464555]">Signing you in with {label}…</p>
        )}
      </div>
    </div>
  );
}

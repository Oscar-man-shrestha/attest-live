"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { requestCampusCode, startMicrosoftSignIn, CampusApiError, MICROSOFT_STATE_KEY } from "@/lib/campus-api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, verifyCampus } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (!isLoading && user) {
      const next = params.get("next") || (user.profileComplete ? "/ideas" : "/profile");
      router.replace(next);
    }
  }, [isLoading, user, params, router]);

  const signInWithOutlook = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url, state } = await startMicrosoftSignIn(params.get("next"));
      sessionStorage.setItem(MICROSOFT_STATE_KEY, state);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "College Outlook sign-in is not available");
      setBusy(false);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestCampusCode(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not send a code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await verifyCampus(email.trim(), code.trim());
      const next = params.get("next") || (result.profileComplete ? "/ideas" : "/profile");
      router.push(result.profileComplete ? next : "/profile");
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "That code did not work");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_0%,_#dce2f7_0%,_transparent_55%),radial-gradient(ellipse_50%_40%_at_0%_100%,_#e9edff_0%,_transparent_50%)]"
      />
      <div className="relative mx-auto max-w-md">
        <Link href="/" className="font-serif text-[28px] font-semibold tracking-tight text-[#141b2b]">
          Attest
        </Link>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4f46e5]">
          Campus sprint · 14 days
        </p>
        <h1 className="mt-4 font-serif text-[28px] sm:text-[32px] font-semibold text-[#141b2b] leading-tight">
          Sign in with your student email
        </h1>
        <p className="mt-2 text-[14px] text-[#464555] leading-relaxed">
          The first sign-in creates the account. Only @bl.students.amrita.edu accounts get in. Attest is not a university product.
        </p>
        <button
          type="button"
          onClick={signInWithOutlook}
          disabled={busy}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#141b2b] text-white text-[13px] font-semibold py-3 disabled:opacity-60 transition-transform active:scale-[0.99]"
        >
          <span className="material-symbols-outlined text-[18px]">mail</span>
          Continue with college Outlook
        </button>
        <p className="mt-5 text-[12px] text-[#777587] text-center">Or get a code by email</p>
        <form onSubmit={sent ? verify : send} className="mt-2 space-y-3 bg-white/90 backdrop-blur rounded-xl p-5 border border-[#e4e2ee] shadow-sm">
          <label className="block text-[12px] font-medium text-[#464555]">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@bl.students.amrita.edu"
              className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
            />
          </label>
          {sent && (
            <label className="block text-[12px] font-medium text-[#464555]">
              Code
              <input
                inputMode="numeric"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="6 digits"
                className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px] tracking-[0.3em]"
              />
            </label>
          )}
          {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold py-2.5 disabled:opacity-60"
          >
            {busy ? "Working…" : sent ? "Enter code" : "Send code"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="px-5 py-16 text-[14px] text-[#777587]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

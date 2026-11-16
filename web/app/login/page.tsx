"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  requestCampusCode,
  startMicrosoftSignIn,
  startGoogleSignIn,
  getSignInMethods,
  CampusApiError,
  MICROSOFT_STATE_KEY,
  GOOGLE_STATE_KEY,
  type SignInMethods,
} from "@/lib/campus-api";
import AttestSeal from "@/components/brand/AttestSeal";
import Stamp from "@/components/brand/Stamp";

/** Google's "G" mark, used only on the Continue with Google button. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, verifyCampus } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Until the server answers, assume only the email code exists, so no dead button ever shows.
  const [methods, setMethods] = useState<SignInMethods>({ google: false, microsoft: false, emailCode: true, emailCodeTestOnly: false });

  useEffect(() => {
    if (!isLoading && user) {
      const next = params.get("next") || (user.profileComplete ? "/ideas" : "/profile");
      router.replace(next);
    }
  }, [isLoading, user, params, router]);

  useEffect(() => {
    getSignInMethods().then(setMethods).catch(() => undefined);
  }, []);

  const startOAuth = async (provider: "google" | "microsoft") => {
    setBusy(true);
    setError(null);
    try {
      const start = provider === "google" ? startGoogleSignIn : startMicrosoftSignIn;
      const { url, state } = await start(params.get("next"));
      sessionStorage.setItem(provider === "google" ? GOOGLE_STATE_KEY : MICROSOFT_STATE_KEY, state);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : `${provider === "google" ? "Google" : "College Outlook"} sign-in is not available`);
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
    <div className="paper-grid min-h-[calc(100vh-4rem)] px-5 py-10 sm:py-16">
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        {/* Why sign in */}
        <div className="hidden lg:block">
          <Link href="/" className="inline-flex items-center gap-2 text-[#4f46e5]">
            <AttestSeal size={34} />
            <span className="font-serif text-[26px] font-bold tracking-tight text-[#141b2b]">Attest</span>
          </Link>
          <h1 className="mt-6 font-serif text-[46px] font-semibold leading-[1.05] tracking-tight text-[#141b2b]">
            Your pass to <span className="hl-indigo">real projects</span>.
          </h1>
          <ul className="mt-7 space-y-4 text-[15px] text-[#464555]">
            {[
              ["how_to_reg", "Sign in with Google or any email. No college ID needed."],
              ["school", "Have a university email? Use it to earn the Verified student stamp and see your own campus first."],
              ["volunteer_activism", "Help people build things. They can thank you with a coffee, and every bit of help shows on your profile."],
              ["payments", "Free to use. Attest never holds anyone's money."],
            ].map(([icon, text]) => (
              <li key={icon} className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-[#4f46e5]" aria-hidden>{icon}</span>
                <span className="max-w-md">{text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Stamp tone="ink" large icon="verified">Proof of help</Stamp>
          </div>
        </div>

        {/* Entry pass */}
        <div className="mx-auto w-full max-w-[420px]">
          <Link href="/" className="mb-5 inline-flex items-center gap-2 text-[#4f46e5] lg:hidden">
            <AttestSeal size={30} />
            <span className="font-serif text-[24px] font-bold tracking-tight text-[#141b2b]">Attest</span>
          </Link>
          <div className="ticket shadow-[0_18px_50px_rgba(20,27,43,0.10)]">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center justify-between">
                <span className="serial">Entry pass</span>
                <span className="serial">Open to everyone</span>
              </div>
              <h2 className="mt-2 font-serif text-[26px] font-semibold leading-tight text-[#141b2b]">Sign in to Attest</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#777587]">
                Use any Google account or any email. The first sign-in creates your account. A university email is optional and earns the Verified student stamp.
              </p>

              {methods.google && (
                <>
                  <button
                    type="button"
                    onClick={() => startOAuth("google")}
                    disabled={busy}
                    className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#c7c4d8] bg-white py-3 text-[14px] font-semibold text-[#141b2b] shadow-[3px_3px_0_0_#141b2b] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#141b2b] disabled:opacity-60"
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>
                  <p className="mt-2 text-center text-[11px] text-[#777587]">Any Google account works.</p>
                </>
              )}

              {methods.google && methods.emailCode && (
                <div className="my-4 flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-[#e4e2ee]" />
                  <span className="serial">or get a code</span>
                  <span className="h-px flex-1 bg-[#e4e2ee]" />
                </div>
              )}

              {methods.emailCode && (
                <form onSubmit={sent ? verify : send} className={`space-y-3 ${methods.google ? "" : "mt-5"}`}>
                  <label className="block text-[12px] font-medium text-[#464555]">
                    Email
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2.5 text-[14px]"
                    />
                  </label>
                  {sent && (
                    <label className="block text-[12px] font-medium text-[#464555]">
                      6-digit code from your inbox
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="••••••"
                        className="ledger mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2.5 text-[18px] tracking-[0.4em]"
                      />
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-[#141b2b] py-3 text-[14px] font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Working…" : sent ? "Enter code" : "Email me a code"}
                  </button>
                  {sent && (
                    <button type="button" onClick={() => { setSent(false); setCode(""); setError(null); }} className="w-full text-center text-[12px] text-[#4f46e5]">
                      Use a different email
                    </button>
                  )}
                  {methods.emailCodeTestOnly && (
                    <p className="text-[11px] text-[#92400e]">Email sending isn&apos;t switched on for this server yet, so only the local test login works here.</p>
                  )}
                </form>
              )}

              {!methods.google && !methods.emailCode && !methods.microsoft && (
                <p className="mt-5 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-[13px] text-[#78350f]">Sign-in isn&apos;t switched on for this server yet. Please check back soon.</p>
              )}

              {error && <p className="mt-3 text-[13px] text-[#ba1a1a]" role="alert">{error}</p>}
            </div>

            {methods.microsoft && (
              <>
                <div className="ticket-tear" />
                <div className="px-6 py-4">
                  <p className="serial">Amrita Bengaluru student?</p>
                  <button
                    type="button"
                    onClick={() => startOAuth("microsoft")}
                    disabled={busy}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#c7c4d8] bg-white py-2.5 text-[13px] font-semibold text-[#141b2b] disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden>mail</span>
                    Continue with college Outlook
                  </button>
                </div>
              </>
            )}
          </div>
          <p className="mt-4 text-center text-[12px] leading-relaxed text-[#777587]">
            By signing in you agree to the <Link href="/rules" className="font-semibold text-[#141b2b] underline underline-offset-2">house rules</Link>: real projects only, never graded coursework.
            Attest is not affiliated with any university or college.
          </p>
        </div>
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

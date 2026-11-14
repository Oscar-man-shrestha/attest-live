"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { signupSchema, loginSchema } from "@embedra/types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "login" | "signup";
}

export default function AuthModal({ isOpen, onClose, defaultMode = "login" }: AuthModalProps) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(defaultMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === "signup") {
        const validation = signupSchema.safeParse({ username, email, password });
        if (!validation.success) {
          const firstError = validation.error.errors[0]?.message || "Validation failed";
          setError(firstError);
          return;
        }
        setIsSubmitting(true);
        await signup({ username, email, password });
      } else {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          const firstError = validation.error.errors[0]?.message || "Validation failed";
          setError(firstError);
          return;
        }
        setIsSubmitting(true);
        await login({ email, password });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-[420px] bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 sm:p-7 shadow-xl space-y-5 text-on-surface">
        {/* Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-outline hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
          title="Close dialog"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Modal Header & Shield Badge */}
        <div className="flex flex-col gap-1.5 pr-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm font-semibold tracking-tight text-on-surface">
              Attest Network
            </h3>
          </div>
          <p className="font-ui-body text-ui-body text-on-surface-variant text-[13px] leading-relaxed pt-1">
            Authenticate with peer credentials to publish hypotheses, evaluate formation seeds, and access private cohort channels.
          </p>
        </div>

        {/* Modal Tabs: Sign In / Create Account */}
        <div className="flex bg-surface-container-low p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-center font-ui-medium text-ui-medium rounded-lg transition-all cursor-pointer ${
              mode === "login"
                ? "bg-surface-container-lowest text-on-surface shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-center font-ui-medium text-ui-medium rounded-lg transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-surface-container-lowest text-on-surface shadow-xs font-semibold"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 text-xs bg-error-container/30 border border-error/30 rounded-xl text-error flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5 text-error">error</span>
            <span className="font-ui-body text-ui-body leading-tight">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm text-outline font-semibold">
                Username
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                  person
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. marcus_dev"
                  className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl font-ui-body text-ui-body text-on-surface placeholder:text-outline/70 focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all"
                />
              </div>
              <span className="font-meta-xs text-meta-xs text-outline">3 to 30 characters</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-outline font-semibold">
              Email Address
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                alternate_email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.org"
                className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl font-ui-body text-ui-body text-on-surface placeholder:text-outline/70 focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-sm text-label-sm text-outline font-semibold">
              Password
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
                lock
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl font-ui-body text-ui-body text-on-surface placeholder:text-outline/70 focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all"
              />
            </div>
            {mode === "signup" && (
              <span className="font-meta-xs text-meta-xs text-outline">At least 6 characters</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-primary-container text-on-primary font-ui-medium text-ui-medium hover:bg-primary transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Authenticating…</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">key</span>
                <span>{mode === "login" ? "Authorize & Sign In" : "Initialize Identity"}</span>
              </>
            )}
          </button>
        </form>

        {/* Modal Footer Note */}
        <div className="pt-2 border-t border-outline-variant/20 text-center">
          <p className="font-meta-xs text-meta-xs text-outline">
            {mode === "login" ? (
              <>
                Don&apos;t have an identity yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  Create Account
                </button>
              </>
            ) : (
              <>
                Already registered with Attest?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

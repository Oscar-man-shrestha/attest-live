"use client";

import { useState } from "react";
import { HANDLE_RE } from "@embedra/types";
import { useAuth } from "@/lib/auth-context";
import { CampusApiError, confirmAdult, sendAppeal, setMyHandle } from "@/lib/campus-api";

/** Handle, age confirmation and (when suspended) the appeal form. Saved immediately, separate from the profile form. */
export default function AccountPanel({ token }: { token: string }) {
  const { user, setCurrentUser } = useAuth();
  const [handle, setHandle] = useState(user?.handle || user?.username || "");
  const [appeal, setAppeal] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!user) return null;

  const run = async (key: string, action: () => Promise<void>, done: string) => {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      await action();
      setNote(done);
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const currentHandle = user.handle || user.username;
  const cleanHandle = handle.trim().toLowerCase();

  return (
    <section className="mt-6 bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4" aria-labelledby="account-heading">
      <h2 id="account-heading" className="text-[13px] font-semibold text-[#141b2b]">Account</h2>

      {user.suspended && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4 text-[13px] text-[#7f1d1d] space-y-2">
          <p className="font-semibold">Your account is suspended.</p>
          {user.suspendedReason && <p>Reason: {user.suspendedReason}</p>}
          <p>You can still read everything. If you think this is wrong, send one appeal and an admin will review it.</p>
          {user.appealed ? (
            <p className="font-semibold">Appeal sent. You&apos;ll get an email when it&apos;s reviewed.</p>
          ) : (
            <>
              <textarea value={appeal} onChange={(e) => setAppeal(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-lg border border-[#fecaca] bg-white px-3 py-2 text-[14px]" placeholder="What happened, in your own words (at least 20 characters)" />
              <button
                type="button"
                disabled={busy === "appeal" || appeal.trim().length < 20}
                onClick={() => run("appeal", async () => { await sendAppeal(token, appeal.trim()); setCurrentUser({ ...user, appealed: true }); }, "Appeal sent")}
                className="px-3 py-2 rounded-lg bg-[#b91c1c] text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {busy === "appeal" ? "Sending…" : "Send appeal"}
              </button>
            </>
          )}
        </div>
      )}

      <div>
        <label className="block text-[12px] font-medium text-[#464555]">Public handle
          <span className="block font-normal text-[#777587]">This is how people see you in deals and threads. Use a pseudonym if you like.</span>
          <div className="mt-1 flex gap-2">
            <span className="inline-flex items-center rounded-lg border border-[#e4e2ee] bg-[#f7f7fb] px-2 text-[14px] text-[#777587]">@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={24} className="w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]" />
            <button
              type="button"
              disabled={busy === "handle" || cleanHandle === currentHandle || !HANDLE_RE.test(cleanHandle)}
              onClick={() => run("handle", async () => { const r = await setMyHandle(token, cleanHandle); setCurrentUser({ ...user, handle: r.handle, username: r.handle }); }, "Handle saved")}
              className="px-3 py-2 rounded-lg border border-[#4f46e5] text-[#4f46e5] text-[13px] font-semibold disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </label>
        {cleanHandle && !HANDLE_RE.test(cleanHandle) && <p className="mt-1 text-[12px] text-[#ba1a1a]">3–24 characters: lowercase letters, numbers and _</p>}
      </div>

      <div className="border-t border-[#eceaf4] pt-4">
        <p className="text-[12px] font-medium text-[#464555]">Paid work</p>
        {user.isAdult ? (
          <p className="mt-1 text-[13px] text-[#15803d]">✓ You confirmed you are 18 or older, so you can take part in paid deals.</p>
        ) : (
          <div className="mt-1 space-y-2">
            <p className="text-[13px] text-[#464555]">Paid and sponsored deals are only for people 18 or older. Under 18? You can still join open-source and credit-only projects.</p>
            <button
              type="button"
              disabled={busy === "adult"}
              onClick={() => run("adult", async () => { await confirmAdult(token); setCurrentUser({ ...user, isAdult: true }); }, "Saved")}
              className="px-3 py-2 rounded-lg border border-[#c7c4d8] text-[13px] font-semibold"
            >
              I confirm I am 18 or older
            </button>
          </div>
        )}
      </div>

      {note && <p className="text-[13px] text-[#15803d]">{note}</p>}
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
    </section>
  );
}

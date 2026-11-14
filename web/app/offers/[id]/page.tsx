"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { acceptOffer, assignTryout, declineOffer, getOffer, type OfferScreen, CampusApiError } from "@/lib/campus-api";

export default function OfferPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [screen, setScreen] = useState<OfferScreen | null>(null);
  const [brief, setBrief] = useState("");
  const [cap, setCap] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    getOffer(token, id).then(setScreen).catch((err) => setError(err.message));
  }, [token, id]);

  if (!screen) return <div className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading the request…"}</div>;

  const statusTone =
    screen.offer.status === "accepted" ? "bg-[#dcfce7] text-[#15803d]"
      : screen.offer.status === "declined" ? "bg-[#fee2e2] text-[#ba1a1a]"
        : screen.offer.status === "tryout" ? "bg-[#fff7ed] text-[#b45309]"
          : "bg-[#eef2ff] text-[#3730a3]";

  return (
    <div className="px-5 py-6 max-w-5xl mx-auto space-y-4">
      <Link href="/inbox" className="text-[12px] font-medium text-[#777587] hover:text-[#4f46e5]">← Inbox</Link>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Handshake</p>
          <h1 className="font-serif text-[32px] font-semibold">Join request</h1>
          <p className="text-[13px] text-[#464555] mt-1">
            {screen.offer.problemId
              ? "Accept publishes the builder’s idea and credits your problem. You can ask to join the build separately."
              : "Accept unlocks the full brief and workspace for this teammate. Decline keeps your private approach gated."}
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider ${statusTone}`}>
          {screen.offer.status}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl p-5 space-y-3 text-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">What they will own</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{screen.offer.body}</p>
          {(screen.offer.skills?.length || 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {screen.offer.skills!.map((skill) => (
                <span key={skill} className="px-2 py-0.5 rounded-full bg-[#eef2ff] text-[#3730a3] text-[11px]">{skill}</span>
              ))}
            </div>
          )}
          {(screen.offer.phases?.length || 0) > 0 && (
            <p className="text-[13px]"><span className="text-[#777587]">Phases </span>{screen.offer.phases!.join(", ")}</p>
          )}
          <p className="text-[13px] text-[#464555]">
            {screen.offer.hoursPerWeek} hours / week
            {screen.offer.availableDays?.length ? ` · ${screen.offer.availableDays.join(", ")}` : ""}
          </p>
          {screen.offer.links.length > 0 && (
            <div className="space-y-1">
              {screen.offer.links.map((link) => (
                <a key={link} href={link} target="_blank" rel="noreferrer" className="block text-[13px] text-[#4f46e5] break-all hover:underline">{link}</a>
              ))}
            </div>
          )}
          {screen.offer.proposal?.title && (
            <div className="rounded-lg bg-[#fffbf5] border border-[#f3e6d4] p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">Problem proposal</p>
              <p className="text-[14px] font-semibold">{screen.offer.proposal.title}</p>
              {screen.offer.proposal.pitch && (
                <p className="text-[13px] text-[#464555] whitespace-pre-wrap">{screen.offer.proposal.pitch}</p>
              )}
              {screen.offer.proposal.audience && (
                <p className="text-[13px]"><span className="text-[#777587]">Who it is for </span>{screen.offer.proposal.audience}</p>
              )}
              {screen.offer.proposal.ships && (
                <p className="text-[13px]"><span className="text-[#777587]">In two weeks </span>{screen.offer.proposal.ships}</p>
              )}
              {screen.offer.proposal.gap && (
                <p className="text-[13px]"><span className="text-[#777587]">Still missing </span>{screen.offer.proposal.gap}</p>
              )}
              {(screen.offer.proposal.helpNeeded?.length || 0) > 0 && (
                <p className="text-[12px] text-[#777587]">Roles {screen.offer.proposal.helpNeeded!.join(", ")}</p>
              )}
            </div>
          )}
          {screen.tryout && (
            <div className="rounded-lg bg-[#fff7ed] border border-[#fed7aa] p-3 text-[13px]">
              <p className="font-semibold text-[#b45309]">Tryout · {screen.tryout.hourCap}h cap</p>
              <p className="mt-1">{screen.tryout.brief}</p>
              {screen.tryout.outcome && <p className="mt-1 text-[#777587]">Outcome: {screen.tryout.outcome}</p>}
            </div>
          )}
          {(screen.offer.ideaId || screen.offer.problemId) && (
            <Link
              href={screen.offer.ideaId ? `/ideas/${screen.offer.ideaId}` : `/problems/${screen.offer.problemId}`}
              className="inline-flex text-[13px] font-semibold text-[#4f46e5]"
            >
              Open {screen.offer.ideaId ? "idea" : "problem"} →
            </Link>
          )}
        </section>
        {screen.profile && <BuilderProfile profile={screen.profile} />}
      </div>

      {screen.canDecide && token && (
        <div className="bg-white rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-3">
          <p className="text-[13px] font-semibold">Your decision</p>
          <div className="flex flex-wrap gap-2 items-end">
            <button
              type="button"
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold disabled:opacity-50"
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await acceptOffer(token, id);
                  router.push(screen.offer.problemId ? `/ideas/${result.ideaId}` : `/ideas/${result.ideaId}/work`);
                } catch (err) {
                  setError(err instanceof CampusApiError ? err.message : "Could not accept");
                  setBusy(false);
                }
              }}
            >
              {screen.offer.problemId ? "Accept proposed idea" : "Accept onto team"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="px-4 py-2 rounded-lg border text-[13px] font-semibold"
              onClick={() => {
                setBusy(true);
                declineOffer(token, id)
                  .then(() => router.push("/inbox"))
                  .catch((err) => {
                    setError(err instanceof CampusApiError ? err.message : "Could not decline");
                    setBusy(false);
                  });
              }}
            >
              Decline
            </button>
          </div>
          {screen.offer.status === "new" && (
            <form
              className="flex flex-wrap gap-2 items-end pt-2 border-t border-[#f1f0f7]"
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                try {
                  await assignTryout(token, id, brief, Number(cap));
                  const next = await getOffer(token, id);
                  setScreen(next);
                } catch (err) {
                  setError(err instanceof CampusApiError ? err.message : "Could not assign a tryout");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="text-[12px] font-medium flex-1 min-w-[180px]">
                Or assign a short tryout
                <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What should they prove in a few hours?" className="mt-1 w-full rounded-lg border px-3 py-2 text-[14px]" required />
              </label>
              <label className="text-[12px] font-medium">
                Hour cap
                <input type="number" min={1} max={8} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="mt-1 w-20 rounded-lg border px-3 py-2 text-[14px]" />
              </label>
              <button className="px-3 py-2 rounded-lg border text-[13px] font-semibold">One tryout</button>
            </form>
          )}
        </div>
      )}
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
    </div>
  );
}

function BuilderProfile({ profile }: { profile: NonNullable<OfferScreen["profile"]> }) {
  const study = [profile.degree, profile.branch, profile.semester ? `Sem ${profile.semester}` : null, profile.graduationYear ? `Class of ${profile.graduationYear}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="bg-white rounded-xl p-5 space-y-3 text-[14px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[#777587]">Applicant snapshot</h2>
      <div>
        <p className="font-semibold text-[16px]">{profile.displayName}</p>
        {profile.headline && <p className="text-[13px] text-[#464555]">{profile.headline}</p>}
        {study && <p className="text-[12px] text-[#777587] mt-1">{study}</p>}
      </div>
      {profile.currentlyWorkingOn && (
        <p className="text-[13px] rounded-lg bg-[#f6f5fc] border border-[#e3e1f1] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Working on </span>
          {profile.currentlyWorkingOn}
        </p>
      )}
      {profile.twoWeekLine && (
        <p className="text-[13px] text-[#464555] whitespace-pre-wrap border-l-2 border-[#4f46e5] pl-3">{profile.twoWeekLine}</p>
      )}
      {profile.cgpa != null && (
        <p className="text-[12px] text-[#464555]">CGPA {Number(profile.cgpa).toFixed(2)} <span className="text-[#777587]">· only visible because they applied to you</span></p>
      )}
      {profile.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <span key={skill.name} className={`px-2 py-0.5 rounded-full text-[11px] ${skill.signed ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#f1f0f7] text-[#464555]"}`}>
              {skill.name}{skill.signed ? " · signed" : ""}
            </span>
          ))}
        </div>
      )}
      {(profile.finished != null || profile.dropped != null) && (
        <p className="text-[12px] text-[#777587]">Finished sprints {profile.finished ?? 0} · declined {profile.dropped ?? 0}</p>
      )}
      {profile.projects?.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-[#777587]">Projects</p>
          <ul className="mt-1 space-y-1">
            {profile.projects.slice(0, 4).map((project) => (
              <li key={project.title} className="text-[13px]">
                {project.url ? <a href={project.url} target="_blank" rel="noreferrer" className="text-[#4f46e5] hover:underline">{project.title}</a> : project.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {profile.githubUrl && (
        <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="inline-flex text-[13px] font-semibold text-[#4f46e5]">
          GitHub{profile.githubStats ? ` · ${profile.githubStats.publicRepos} repos` : ""} →
        </a>
      )}
    </section>
  );
}

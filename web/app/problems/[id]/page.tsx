"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addFreshLine, createOffer, fileReport, getSprintProblem, CampusApiError, type SprintProblem } from "@/lib/campus-api";

export default function ProblemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const [problem, setProblem] = useState<SprintProblem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [audience, setAudience] = useState("");
  const [gap, setGap] = useState("");
  const [ships, setShips] = useState("");
  const [visibility, setVisibility] = useState<"minimal" | "standard">("standard");
  const [blurb, setBlurb] = useState("");
  const [roles, setRoles] = useState("Build");
  const [hours, setHours] = useState(4);
  const [days, setDays] = useState("Sat");
  const [skills, setSkills] = useState("");
  const [phases, setPhases] = useState("");
  const [fresh, setFresh] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    getSprintProblem(token, id).then((data) => setProblem(data.problem)).catch((err) => setError(err.message));
  }, [token, id]);

  if (!problem) return <div className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading…"}</div>;
  const mine = user?.id === problem.authorId;

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto space-y-4">
      <p className="text-[11px] uppercase tracking-wider text-[#b45309] font-semibold">
        {problem.hasIdea ? "PROBLEM · HAS IDEA" : "PROBLEM · NEEDS IDEA"}
      </p>
      <p className="text-[11px] uppercase tracking-wider text-[#777587]">{problem.source} · {problem.authorBranch} · Sem {problem.authorSemester}</p>
      <h1 className="font-serif text-[34px] font-semibold">{problem.title}</h1>
      <div className="bg-white rounded-xl p-4 space-y-2 text-[14px] border border-[#f3e6d4]/80">
        <p>{problem.whatHappens}</p>
        <p><span className="text-[#777587]">Who feels it </span>{problem.whoFeels}</p>
        <p><span className="text-[#777587]">A fix would </span>{problem.fixWouldChange}</p>
        <p className="text-[12px] text-[#777587]">{problem.hideName ? "Name hidden" : problem.authorName}</p>
        {problem.hasIdea && problem.ideaId && <div className="space-y-1"><Link href={`/ideas/${problem.ideaId}`} className="text-[#4f46e5] text-[13px] font-semibold">Open linked idea →</Link><p className="text-[12px] text-[#777587]">{mine ? "You are credited" : "The reporter is credited"} as the problem source. Joining the build takes a separate request on the idea page.</p></div>}
        {problem.freshLine && <p className="text-[13px]">Fresh line: {problem.freshLine}</p>}
      </div>
      {problem.approach && (
        <div className="bg-[#fff7ed] rounded-xl p-4 text-[14px] border border-[#f3e6d4]">
          <p className="text-[12px] font-semibold text-[#b45309]">Unlocked notes</p>
          <p className="mt-1 whitespace-pre-wrap">{problem.approach.body}</p>
        </div>
      )}
      {mine && problem.needsFreshLine && token && (
        <form className="flex gap-2" onSubmit={async (event) => {
          event.preventDefault();
          await addFreshLine(token, problem.id, fresh);
          setProblem({ ...problem, freshLine: fresh, needsFreshLine: false });
        }}>
          <input value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder="One fresh line" className="flex-1 rounded-lg border px-3 py-2 text-[14px]" />
          <button className="px-3 rounded-lg bg-[#b45309] text-white text-[13px]">Save line</button>
        </form>
      )}
      {!mine && !problem.hasIdea && token && (
        <form className="bg-white rounded-xl p-4 space-y-2 border border-[#f3e6d4]/80" onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            const result = await createOffer(token, {
              problemId: problem.id,
              body,
              hoursPerWeek: hours,
              availableDays: days.split(",").map((day) => day.trim()).filter(Boolean),
              links: [],
              skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
              phases: phases.split(",").map((s) => s.trim()).filter(Boolean),
              proposal: {
                title, pitch, audience, gap, ships,
                helpNeeded: roles.split(",").map((role) => role.trim()).filter(Boolean),
                hideName: false,
                visibility,
                blurb: blurb.trim() || undefined,
                isSmall: false,
                stage: "idea",
              },
            });
            setSent(true);
            router.push(`/offers/${result.offer.id}`);
          } catch (err) {
            setError(err instanceof CampusApiError ? err.message : "Could not propose");
          }
        }}>
          <p className="font-semibold text-[14px] text-[#b45309]">Propose an idea</p>
          <p className="text-[12px] text-[#777587]">Your profile ships with the request. If accepted, you own the build and should set the first task. The problem reporter receives source credit and may ask to join.</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Idea title" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Pitch" rows={2} className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <label className="block text-[12px] font-medium text-[#464555]">Who can read your brief?
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} className="mt-1 w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]">
              <option value="minimal">Minimal — teaser and roles public</option>
              <option value="standard">Standard — full brief public</option>
            </select>
          </label>
          <input value={blurb} onChange={(e) => setBlurb(e.target.value)} minLength={visibility === "minimal" ? 12 : undefined} maxLength={160} required={visibility === "minimal"} placeholder="Short public teaser (required for Minimal)" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who it is for" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <textarea value={ships} onChange={(e) => setShips(e.target.value)} placeholder="What will exist in two weeks" rows={2} className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <input value={gap} onChange={(e) => setGap(e.target.value)} placeholder="What is still missing" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="Roles" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Proposal, at least 40 characters, in your words" rows={3} className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Skills you bring, comma separated" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <input value={phases} onChange={(e) => setPhases(e.target.value)} placeholder="Phases you want (e.g. research, build, demo)" className="w-full rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          <div className="flex gap-2">
            <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-24 rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
            <input value={days} onChange={(e) => setDays(e.target.value)} className="flex-1 rounded-lg border border-[#e8d9c4] px-3 py-2 text-[14px]" />
          </div>
          {sent ? (
            <p className="text-[13px] text-[#15803d] font-medium">Proposal sent — watch Inbox for their decision.</p>
          ) : (
            <button className="px-4 py-2 rounded-lg bg-[#b45309] text-white text-[13px] font-semibold hover:bg-[#92400e] transition-colors">Send proposal</button>
          )}
        </form>
      )}
      {!mine && !problem.hasIdea && !token && (
        <Link href="/login" className="inline-flex px-4 py-2 rounded-lg bg-[#b45309] text-white text-[13px] font-semibold">
          Propose an idea
        </Link>
      )}
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {notice && <p className="text-[13px] text-[#464555]">{notice}</p>}
      {token && (
        <button
          type="button"
          className="text-[12px] text-[#777587] hover:text-[#ba1a1a]"
          onClick={() => {
            fileReport(token, "problem", problem.id, "spam")
              .then(() => setNotice("Reported. An admin will review it."))
              .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not report"));
          }}
        >
          Report spam
        </button>
      )}
    </div>
  );
}

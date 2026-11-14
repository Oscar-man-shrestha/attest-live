"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BRANCHES, DEGREES, INTEREST_POOL, SKILL_POOL, TWO_WEEK_EXAMPLES, type DocumentExtraction } from "@embedra/types";
import { saveCampusProfile, relatedInterests, branchPopularity, CampusApiError } from "@/lib/campus-api";
import PickPool from "@/components/campus/PickPool";
import ProofStep, { type ProofDraft } from "@/components/campus/ProofStep";

const MIN_INTERESTS = 3;
const MAX_SKILLS = 8;
const STEPS = ["Who you are", "Your proof", "What you are into", "What you can do"];
const GITHUB_RE = /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9-]+\/?$/;
const LINKEDIN_RE = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+\/?$/;
const URL_RE = /^https?:\/\/\S+$/i;

const field = "mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]";

function clean<T extends Record<string, unknown>>(item: T) {
  return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined && v !== "")) as T;
}

export default function CampusProfilePage() {
  const { user, token, isLoading, setCurrentUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [branch, setBranch] = useState("CSE");
  const [semester, setSemester] = useState(1);
  const [degree, setDegree] = useState("B.Tech");
  const [graduationYear, setGraduationYear] = useState<string>("");
  const [cgpa, setCgpa] = useState("");
  const [headline, setHeadline] = useState("");
  const [proof, setProof] = useState<ProofDraft>({ githubUrl: "", linkedinUrl: "", siteUrl: "", projects: [], certifications: [], experience: [] });
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [twoWeekLine, setTwoWeekLine] = useState("");
  const [currentlyWorkingOn, setCurrentlyWorkingOn] = useState("");
  const [fromRoll, setFromRoll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<Record<string, string[]>>({});
  const [popular, setPopular] = useState<{ interests: string[]; skills: string[] }>({ interests: [], skills: [] });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/profile");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const guess = user.guess;
    setDisplayName(user.displayName || "");
    setBranch(user.branch || guess?.branch || "CSE");
    setSemester(user.semester || guess?.semester || 1);
    setDegree(user.degree || guess?.degree || "B.Tech");
    setGraduationYear(String(user.graduationYear || guess?.graduationYear || ""));
    setFromRoll(Boolean(!user.branch && guess?.branch));
    setCgpa(user.cgpa === null || user.cgpa === undefined ? "" : String(user.cgpa));
    setHeadline(user.headline || "");
    setProof({
      githubUrl: user.githubUrl || "",
      linkedinUrl: user.linkedinUrl || "",
      siteUrl: user.siteUrl || "",
      projects: (user.projects || []).map((p) => clean({ title: p.title, url: p.url || undefined, summary: p.summary })),
      certifications: (user.certifications || []).map((c) => clean({ name: c.name, issuer: c.issuer, year: c.year || undefined, url: c.url || undefined })),
      experience: user.experience || [],
    });
    setInterests(user.interests || []);
    setSkills(user.campusSkills || []);
    setTwoWeekLine(user.twoWeekLine || "");
    setCurrentlyWorkingOn((user as { currentlyWorkingOn?: string | null }).currentlyWorkingOn || "");
  }, [user]);

  useEffect(() => {
    if (!token) return;
    relatedInterests(token).then((data) => setRelated(data.related)).catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token || !branch) return;
    branchPopularity(token, branch).then((data) => setPopular({ interests: data.interests, skills: data.skills })).catch(() => undefined);
  }, [token, branch]);

  /** Fills fields owned by other steps from a parsed resume. Returns what it changed, for the summary. */
  const applyResume = (result: DocumentExtraction) => {
    const filled: string[] = [];
    if (!cgpa && result.cgpa !== null) { setCgpa(String(result.cgpa)); filled.push("CGPA"); }
    if (!headline && result.headline) { setHeadline(result.headline.slice(0, 120)); filled.push("headline"); }
    if (result.degree && (DEGREES as readonly string[]).includes(result.degree) && !user?.degree) setDegree(result.degree);
    if (result.graduationYear && !user?.graduationYear) setGraduationYear(String(result.graduationYear));
    const newSkills = result.skills.filter((s) => !skills.includes(s));
    const room = Math.max(0, MAX_SKILLS - skills.length);
    if (newSkills.length && room) {
      setSkills([...skills, ...newSkills.slice(0, room)]);
      filled.push(`${Math.min(room, newSkills.length)} skills`);
    }
    return filled;
  };

  const validate = (at: number) => {
    if (at === 0) {
      if (!displayName.trim()) return "Add your name";
      if (cgpa && !(Number(cgpa) >= 0 && Number(cgpa) <= 10)) return "CGPA is on a 10-point scale";
      if (graduationYear && !/^20\d{2}$/.test(graduationYear)) return "Graduation year looks wrong";
    }
    if (at === 1) {
      if (proof.githubUrl && !GITHUB_RE.test(proof.githubUrl)) return "Use your GitHub profile link, like https://github.com/username";
      if (proof.linkedinUrl && !LINKEDIN_RE.test(proof.linkedinUrl)) return "Use your LinkedIn profile link, like https://www.linkedin.com/in/name";
      if (proof.siteUrl && !URL_RE.test(proof.siteUrl)) return "The portfolio link must start with https://";
      if (proof.projects.some((p) => p.title.trim().length < 2)) return "Every project needs a title";
      if (proof.projects.some((p) => p.url && !URL_RE.test(p.url))) return "Project links must start with https://";
      if (proof.certifications.some((c) => c.name.trim().length < 2)) return "Every certification needs a name";
      if (proof.certifications.some((c) => c.url && !URL_RE.test(c.url))) return "Certificate links must start with https://";
      if (proof.experience.some((e) => e.role.trim().length < 2 || e.org.trim().length < 2)) return "Every role needs a title and an organisation";
    }
    if (at === 2 && interests.length < MIN_INTERESTS) return `Pick at least ${MIN_INTERESTS} interests`;
    return null;
  };

  const next = () => {
    const problem = validate(step);
    if (problem) return setError(problem);
    setError(null);
    setStep((n) => n + 1);
  };

  const save = async () => {
    if (!token) return;
    for (let at = 0; at < 3; at += 1) {
      const problem = validate(at);
      if (problem) { setStep(at); return setError(problem); }
    }
    if (twoWeekLine.trim().length < 8) {
      return setError("Write what you could build or help with, or tap one of the examples. The grey text is only a hint.");
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveCampusProfile(token, {
        displayName,
        branch,
        semester: Number(semester),
        degree,
        graduationYear: graduationYear ? Number(graduationYear) : null,
        cgpa: cgpa ? Number(cgpa) : null,
        headline: headline.trim() || null,
        githubUrl: proof.githubUrl || null,
        linkedinUrl: proof.linkedinUrl || null,
        siteUrl: proof.siteUrl || null,
        projects: proof.projects.map((p) => clean({ ...p, title: p.title.trim() })),
        certifications: proof.certifications.map((c) => clean({ ...c, name: c.name.trim() })),
        experience: proof.experience.map((e) => clean({ ...e, role: e.role.trim(), org: e.org.trim() })),
        interests,
        skills,
        twoWeekLine,
        currentlyWorkingOn: currentlyWorkingOn.trim() || null,
      });
      setCurrentUser(saved.user);
      router.push(user?.id ? `/profile/${user.id}` : "/ideas");
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not save the profile");
    } finally {
      setBusy(false);
    }
  };

  const university = user?.university || "Amrita Vishwa Vidyapeetham, Bengaluru";
  const last = STEPS.length - 1;
  const editing = Boolean(user?.profileComplete);

  return (
    <div className="px-5 py-8 max-w-2xl mx-auto">
      {editing ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Your profile</p>
              <h1 className="font-serif text-[32px] font-semibold mt-1">Edit profile</h1>
            </div>
            {user?.id && (
              <Link href={`/profile/${user.id}`} className="text-[13px] font-semibold text-[#4f46e5] shrink-0 mt-2">View public profile</Link>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-1">
            {STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => { setError(null); setStep(index); }}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${step === index ? "bg-[#141b2b] text-white" : "text-[#464555] hover:bg-[#f1f0f7]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Step {step + 1} of {STEPS.length}</p>
          <h1 className="font-serif text-[32px] font-semibold mt-1">{STEPS[step]}</h1>
        </>
      )}
      <div className="mt-6 bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-4">
        {editing && <p className="text-[13px] font-semibold text-[#141b2b]">{STEPS[step]}</p>}
        {step === 0 && (
          <>
            <label className="block text-[12px] font-medium">Name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={field} />
            </label>
            <div className="text-[12px] font-medium">University
              <div className="mt-1 flex items-center justify-between rounded-lg border border-[#e4e2ee] bg-[#f7f7fb] px-3 py-2 text-[14px]">
                <span>{university}</span>
                <span className="text-[11px] font-semibold text-[#15803d]">✓ Verified by college email</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-medium">Degree
                <select value={degree} onChange={(e) => setDegree(e.target.value)} className={field}>
                  {DEGREES.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-medium">Branch
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className={field}>
                  {BRANCHES.map((code) => <option key={code}>{code}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-medium">Semester
                <select value={semester} onChange={(e) => setSemester(Number(e.target.value))} className={field}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-medium">Graduation year
                <input value={graduationYear} inputMode="numeric" maxLength={4} onChange={(e) => setGraduationYear(e.target.value.replace(/\D/g, ""))} placeholder="2027" className={field} />
              </label>
            </div>
            {fromRoll && <p className="text-[12px] text-[#777587] -mt-2">Branch, semester and year were filled from your roll number. Change them if they are wrong.</p>}
            <label className="block text-[12px] font-medium">Headline
              <input value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} placeholder="Embedded systems and IoT, building low-power sensors" className={field} />
            </label>
            <label className="block text-[12px] font-medium">Current CGPA <span className="font-normal text-[#777587]">(optional)</span>
              <input value={cgpa} inputMode="decimal" onChange={(e) => setCgpa(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} placeholder="8.4" className={field} />
              <span className="block font-normal text-[#777587] mt-1">Only owners of ideas you ask to join can see it. It is not on your public profile.</span>
            </label>
          </>
        )}
        {step === 1 && token && <ProofStep token={token} value={proof} onChange={setProof} onResume={applyResume} />}
        {step === 2 && (
          <>
            <p className="text-[13px] text-[#464555]">Pick at least {MIN_INTERESTS}. Each pick brings up a related option, so keep going if more fit. Attest uses these to pick ideas and students for you.</p>
            <PickPool pool={INTEREST_POOL} branch={branch} picked={interests} onChange={setInterests} cap={20} related={related} popular={popular.interests} />
          </>
        )}
        {step === 3 && (
          <>
            <p className="text-[13px] text-[#464555]">Skills you already use. Teams looking for these see your ideas matched first.</p>
            <PickPool pool={SKILL_POOL} branch={branch} picked={skills} onChange={setSkills} cap={MAX_SKILLS} allowCustom popular={popular.skills} />
            <p className="text-[12px] text-[#777587]">A skill is signed only when a teammate signs a task that used it.</p>
            <div className="pt-2 border-t border-[#eceaf4]">
              <label className="block text-[12px] font-medium">What could you build or help with in the next two weeks?
                <span className="block font-normal text-[#777587] mt-0.5">One or two sentences about the part you could own in a 14-day sprint. Teams read this when you ask to join.</span>
                <textarea
                  value={twoWeekLine}
                  onChange={(e) => setTwoWeekLine(e.target.value)}
                  rows={3}
                  placeholder="Type here, or tap an example below"
                  className="mt-2 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
                />
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(TWO_WEEK_EXAMPLES[branch as keyof typeof TWO_WEEK_EXAMPLES] || []).map((example) => (
                  <button type="button" key={example} onClick={() => setTwoWeekLine(example)} className="text-left px-3 py-1.5 rounded-lg text-[12px] bg-[#f1f0f7] text-[#464555]">
                    Use: {example}
                  </button>
                ))}
              </div>
              <label className="block text-[12px] font-medium mt-4">Currently working on
                <span className="block font-normal text-[#777587] mt-0.5">Optional one-liner shown on your public profile (open teams also appear automatically).</span>
                <input
                  value={currentlyWorkingOn}
                  onChange={(e) => setCurrentlyWorkingOn(e.target.value)}
                  maxLength={160}
                  placeholder="e.g. Building a mess-menu bot with two CSE juniors"
                  className="mt-2 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
                />
              </label>
            </div>
          </>
        )}
        {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
        <div className="flex justify-between gap-3">
          <button type="button" disabled={step === 0 && !editing} onClick={() => { setError(null); setStep((n) => Math.max(0, n - 1)); }} className="text-[13px] text-[#464555] disabled:opacity-40">Back</button>
          <div className="flex gap-2">
            {editing && (
              <button type="button" disabled={busy} onClick={save} className="px-4 py-2 rounded-lg border border-[#4f46e5] text-[#4f46e5] text-[13px] font-semibold">
                {busy ? "Saving…" : "Save changes"}
              </button>
            )}
            {step < last ? (
              <button type="button" onClick={next} className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold">Continue</button>
            ) : !editing ? (
              <button type="button" disabled={busy} onClick={save} className="px-4 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold">{busy ? "Saving…" : "Save profile"}</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

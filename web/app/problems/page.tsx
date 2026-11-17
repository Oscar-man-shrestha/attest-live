"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BRANCHES } from "@embedra/types";
import { listSprintProblems, saveCard, type SprintProblem } from "@/lib/campus-api";
import CampusSwitch, { useCampusScope } from "@/components/campus/CampusSwitch";
import EmptyState from "@/components/campus/EmptyState";

export default function ProblemsPage() {
  const { token, user, isLoading } = useAuth();
  const [rows, setRows] = useState<SprintProblem[]>([]);
  const [sunk, setSunk] = useState<SprintProblem[]>([]);
  const [branch, setBranch] = useState("");
  const [noIdea, setNoIdea] = useState(false);
  const [scope, setScope] = useCampusScope();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const params: Record<string, string> = {};
    if (branch) params.branch = branch;
    if (noIdea) params.noIdea = "1";
    if (scope === "campus") params.campus = "1";
    listSprintProblems(token, params).then((data) => setRows(data.problems)).catch((err) => setError(err.message));
    listSprintProblems(token, { ...params, bucket: "sunk" }).then((data) => setSunk(data.problems)).catch(() => {});
  }, [token, branch, noIdea, scope]);

  if (!isLoading && !user) return null;

  const badge = (problem: SprintProblem) =>
    problem.hasIdea ? "PROBLEM · HAS IDEA" : "PROBLEM · NEEDS IDEA";

  const card = (problem: SprintProblem) => (
    <article
      key={problem.id}
      className="group bg-white rounded-xl p-4 border border-[#f3e6d4]/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(180,83,9,0.1)] transition-shadow duration-200"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-[#b45309] font-semibold">
            {badge(problem)}
            {problem.sameCampus && <span className="ml-2 normal-case tracking-normal text-[#3730a3]">· Same campus</span>}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-[#777587] mt-0.5">
            {problem.source} · {problem.authorBranch} · Sem {problem.authorSemester}
          </p>
          <Link
            href={`/problems/${problem.id}`}
            className="font-serif text-[20px] font-semibold text-[#141b2b] hover:text-[#b45309] transition-colors"
          >
            {problem.title}
          </Link>
          <p className="text-[14px] text-[#464555] mt-1 line-clamp-3">{problem.whatHappens}</p>
          {problem.needsFreshLine && <p className="text-[12px] text-[#ba1a1a] mt-2">Needs one fresh line</p>}
          {!problem.hasIdea && (
            <Link
              href={`/problems/${problem.id}`}
              className="inline-flex mt-3 text-[13px] font-semibold text-[#b45309] hover:underline"
            >
              Propose an idea →
            </Link>
          )}
          {problem.hasIdea && problem.ideaId && (
            <Link
              href={`/ideas/${problem.ideaId}`}
              className="inline-flex mt-3 text-[13px] font-semibold text-[#4f46e5] hover:underline"
            >
              Open linked idea →
            </Link>
          )}
        </div>
        {token && (
          <button
            type="button"
            className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-[12px] font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
              problem.saved
                ? "border-[#b45309] bg-[#fff7ed] text-[#b45309]"
                : "border-[#c7c4d8]/70 hover:bg-[#fffbf5] text-[#464555]"
            }`}
            onClick={async () => {
              await saveCard(token, "problem", problem.id, !problem.saved);
              setRows((list) => list.map((row) => (row.id === problem.id ? { ...row, saved: !row.saved } : row)));
            }}
          >
            <span className="material-symbols-outlined text-[16px]">
              {problem.saved ? "bookmark" : "bookmark_border"}
            </span>
            <span>{problem.saved ? "Saved" : "Save"}</span>
          </button>
        )}
      </div>
    </article>
  );

  return (
    <div className="px-5 py-6 max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#b45309]">Real pains</p>
          <h1 className="font-serif text-[32px] font-semibold">Problems</h1>
          <p className="text-[13px] text-[#777587] mt-1">Pains needing a builder</p>
        </div>
        <Link href="/problems/new" className="px-3 py-2 rounded-lg bg-[#b45309] text-white text-[13px] font-semibold hover:bg-[#92400e] transition-colors">
          Report a problem
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <CampusSwitch value={scope} onChange={setScope} />
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-lg border border-[#c7c4d8] px-3 py-2 text-[13px]">
          <option value="">All branches</option>
          {BRANCHES.map((code) => <option key={code}>{code}</option>)}
        </select>
        <label className="text-[13px] flex items-center gap-2">
          <input type="checkbox" checked={noIdea} onChange={(e) => setNoIdea(e.target.checked)} />
          No idea yet
        </label>
      </div>
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {!error && rows.length === 0 && sunk.length === 0 && (
        <EmptyState
          title={branch || noIdea ? "No problems match this filter" : "No problems on the board"}
          body={
            branch || noIdea
              ? "Try clearing the branch filter, or report the first problem for this branch."
              : "Describe something that breaks campus life in concrete terms. Someone else can propose an idea from it."
          }
          onAction={branch || noIdea ? () => { setBranch(""); setNoIdea(false); } : undefined}
          actionLabel={branch || noIdea ? "Reset filters" : "Report a problem"}
          actionHref={!(branch || noIdea) ? "/problems/new" : undefined}
          secondaryHref={branch || noIdea ? "/problems/new" : "/ideas/new"}
          secondaryLabel={branch || noIdea ? "Report a problem" : "Post idea"}
        />
      )}
      {rows.map(card)}
      {sunk.length > 0 && <h2 className="font-serif text-[22px] pt-2">Quiet since day 7</h2>}
      {sunk.map(card)}
    </div>
  );
}

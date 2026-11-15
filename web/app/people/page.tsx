"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { invitePerson, listPeople, followCampusPerson, unfollowCampusPerson, CampusApiError, type PeoplePage, type PeopleScope, type Person } from "@/lib/campus-api";
import { Avatar } from "@/components/campus/CommentThread";
import EmptyState from "@/components/campus/EmptyState";

const SCOPES: { value: PeopleScope; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "campus", label: "My campus" },
  { value: "branch", label: "My branch" },
  { value: "cohort", label: "My branch & semester" },
];

export default function PeoplePage() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const [scope, setScope] = useState<PeopleScope>("all");
  const [page, setPage] = useState<PeoplePage | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login?next=/people");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!token) return;
    setPage(null);
    listPeople(token, scope)
      .then((data) => { setPage(data); setPeople(data.people); })
      .catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load students"));
  }, [token, scope]);

  const more = async () => {
    if (!token || !page?.nextCursor) return;
    const next = await listPeople(token, scope, page.nextCursor);
    setPeople((list) => [...list, ...next.people.filter((p) => !list.some((row) => row.id === p.id))]);
    setPage((current) => (current ? { ...current, nextCursor: next.nextCursor } : current));
  };

  const invite = async (person: Person) => {
    if (!token || !page) return;
    const ideaId = picked[person.id] || page.myOpenIdeas[0]?.id;
    if (!ideaId) return;
    try {
      await invitePerson(token, person.id, ideaId);
      setNotes((n) => ({ ...n, [person.id]: "Invite sent" }));
    } catch (err) {
      setNotes((n) => ({ ...n, [person.id]: err instanceof CampusApiError ? err.message : "Could not invite" }));
    }
  };

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4f46e5]">Students like you</p>
        <h1 className="font-serif text-[32px] font-semibold">People</h1>
        <p className="text-[13px] text-[#464555]">Ranked by how close your profiles are, your branch and semester, shared interests and skills, and the ideas you both engaged with.</p>
      </div>

      {page?.circle && (
        <div className="rounded-xl bg-[#eef2ff] border border-[#e0e7ff] p-3">
          <p className="text-[13px] text-[#3730a3]"><span className="font-semibold">Your circle: {page.circle.label}</span> · {page.circle.size} students</p>
          <p className="text-[12px] text-[#464555] mt-0.5">Circles group students by what they are into. Ideas popular in your circle rank higher in your feed.</p>
        </div>
      )}

      <div className="flex gap-1">
        {SCOPES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setScope(item.value)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-medium ${scope === item.value ? "bg-[#141b2b] text-white" : "text-[#464555] hover:bg-[#f1f0f7]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {!page && !error && <p className="text-[13px] text-[#777587]">Finding students…</p>}
      {page && people.length === 0 && (
        <EmptyState
          title={scope === "all" ? "You are early" : "Nobody in this filter yet"}
          body={scope === "all"
            ? "As more classmates finish their profiles, they show up here ranked by shared skills, interests, and branch."
            : "Widen the filter to Everyone, or finish your own profile so matching has more to go on."}
          actionHref={scope === "all" ? "/profile" : undefined}
          actionLabel={scope === "all" ? "Finish your profile" : undefined}
        />
      )}
      {page && people.length === 0 && scope !== "all" && (
        <button type="button" onClick={() => setScope("all")} className="text-[13px] font-semibold text-[#4f46e5]">
          Show everyone
        </button>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {people.map((person) => (
          <article key={person.id} className="bg-white rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col">
            <div className="flex items-start gap-3">
              <Avatar name={person.displayName || "?"} size={44} />
              <div className="min-w-0 flex-1">
                <Link href={`/profile/${person.id}`} className="text-[15px] font-semibold hover:underline">{person.displayName}</Link>
                {person.headline && <p className="text-[12px] text-[#464555] line-clamp-2">{person.headline}</p>}
                <p className="text-[11px] text-[#777587]">{[person.degree, person.branch, person.semester ? `Sem ${person.semester}` : null].filter(Boolean).join(" · ")}</p>
              </div>
              <span className="text-[12px] font-semibold text-[#4f46e5]">{person.match}%</span>
            </div>
            {person.reasons.length > 0 && <p className="text-[12px] text-[#4f46e5] mt-2">{person.reasons.join(" · ")}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {person.skills.slice(0, 5).map((skill) => (
                <span key={skill} className={`px-2 py-0.5 rounded-full text-[11px] ${person.sharedSkills.includes(skill) ? "bg-[#e0e7ff] text-[#3730a3]" : "bg-[#f1f0f7] text-[#464555]"}`}>{skill}</span>
              ))}
            </div>
            {person.circle && <p className="text-[11px] text-[#777587] mt-2">Circle: {person.circle.label}</p>}
            <div className="mt-auto pt-3 flex items-center gap-2 flex-wrap">
              <Link href={`/profile/${person.id}`} className="px-3 py-1.5 rounded-full border border-[#4f46e5] text-[#4f46e5] text-[12px] font-semibold">View profile</Link>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold ${following[person.id] ? "border border-[#c7c4d8] text-[#464555]" : "border border-[#4f46e5] text-[#4f46e5]"}`}
                onClick={async () => {
                  if (!token) return;
                  try {
                    const result = following[person.id]
                      ? await unfollowCampusPerson(token, person.id)
                      : await followCampusPerson(token, person.id);
                    setFollowing((map) => ({ ...map, [person.id]: result.following }));
                  } catch (err) {
                    setNotes((n) => ({ ...n, [person.id]: err instanceof CampusApiError ? err.message : "Could not follow" }));
                  }
                }}
              >
                {following[person.id] ? "Following" : "Follow"}
              </button>
              {page && page.myOpenIdeas.length > 0 && (
                <>
                  {page.myOpenIdeas.length > 1 && (
                    <select value={picked[person.id] || page.myOpenIdeas[0].id} onChange={(e) => setPicked((p) => ({ ...p, [person.id]: e.target.value }))} className="min-w-0 flex-1 rounded-full border border-[#c7c4d8] px-2 py-1.5 text-[11px]">
                      {page.myOpenIdeas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => invite(person)} className="px-3 py-1.5 rounded-full bg-[#4f46e5] text-white text-[12px] font-semibold">Invite</button>
                </>
              )}
            </div>
            {notes[person.id] && <p className="text-[11px] text-[#4f46e5] mt-1">{notes[person.id]}</p>}
          </article>
        ))}
      </div>

      {page?.nextCursor && (
        <button type="button" onClick={() => more().catch(() => undefined)} className="w-full py-2 rounded-lg border border-[#c7c4d8] text-[13px]">Show more</button>
      )}
      {page && !page.usingModel && people.length > 0 && (
        <p className="text-[11px] text-[#777587]">Matching on branch, interests and skills while the language model is offline.</p>
      )}
    </div>
  );
}

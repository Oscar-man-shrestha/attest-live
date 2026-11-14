"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getCampusProfile,
  getProfileIdeas,
  invitePerson,
  followCampusPerson,
  unfollowCampusPerson,
  uploadProfileMedia,
  CampusApiError,
  type CampusProfile,
  type SprintIdea,
} from "@/lib/campus-api";
import PostActions from "@/components/campus/PostActions";
import { Avatar, timeAgo } from "@/components/campus/CommentThread";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-[#141b2b]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ self, text, cta }: { self: boolean; text: string; cta: string }) {
  return self
    ? <Link href="/profile" className="text-[13px] text-[#4f46e5]">{cta}</Link>
    : <p className="text-[13px] text-[#777587]">{text}</p>;
}

export default function CampusProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, user, isLoading } = useAuth();
  const [data, setData] = useState<CampusProfile | null>(null);
  const [posts, setPosts] = useState<SprintIdea[]>([]);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [myOpenIdeas, setMyOpenIdeas] = useState<SprintIdea[]>([]);
  const [inviteIdea, setInviteIdea] = useState("");
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=/profile/${id}`);
  }, [isLoading, user, router, id]);

  useEffect(() => {
    if (!token || !id) return;
    setData(null);
    setError(null);
    getCampusProfile(token, id).then(setData).catch((err) => setError(err instanceof CampusApiError ? err.message : "Could not load the profile"));
    getProfileIdeas(token, id).then((page) => { setPosts(page.ideas); setPostsCursor(page.nextCursor); }).catch(() => undefined);
  }, [token, id]);

  useEffect(() => {
    if (!token || !user || user.id === id) return;
    getProfileIdeas(token, user.id)
      .then((page) => {
        const open = page.ideas.filter((idea) => idea.teamStatus === "open");
        setMyOpenIdeas(open);
        if (open[0]) setInviteIdea(open[0].id);
      })
      .catch(() => undefined);
  }, [token, user, id]);

  if (error) return <div className="px-5 py-10 text-[14px] text-[#777587]">{error}</div>;
  if (!data || !token) return <div className="px-5 py-10 text-[14px] text-[#777587]">Loading the profile…</div>;

  const { profile, stats, teams, currentlyWorking = [], signedTrail = [] } = data;
  const self = profile.isSelf;
  const study = [profile.degree, profile.branch, profile.semester ? `Semester ${profile.semester}` : null, profile.graduationYear ? `Class of ${profile.graduationYear}` : null]
    .filter(Boolean).join(" · ");
  const statTiles: [string, number][] = [
    ["Ideas posted", stats.ideasPosted],
    ["Teams joined", stats.teamsJoined],
    ["Shipped", stats.shipped],
    ["Signed tasks", stats.signedTasks],
    ["Likes received", stats.likesReceived],
    ["Comments", stats.comments],
  ];

  const loadMorePosts = async () => {
    if (!postsCursor) return;
    const page = await getProfileIdeas(token, id, postsCursor);
    setPosts((list) => [...list, ...page.ideas.filter((idea) => !list.some((row) => row.id === idea.id))]);
    setPostsCursor(page.nextCursor);
  };

  const uploadSlot = async (slot: "avatar" | "cover", file: File | undefined) => {
    if (!file || !token) return;
    try {
      const { resizeImage } = await import("@/lib/resize-image");
      const resized = await resizeImage(file, slot === "cover" ? 1800 : 800);
      const result = await uploadProfileMedia(token, slot, resized);
      setData((prev) => prev ? {
        ...prev,
        profile: {
          ...prev.profile,
          ...(slot === "avatar" ? { profilePicUrl: result.url } : { coverUrl: result.url }),
        },
      } : prev);
      setInviteNote(null);
    } catch (err) {
      setInviteNote(err instanceof CampusApiError ? err.message : err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="px-5 py-6 max-w-4xl mx-auto grid lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4 min-w-0">
        <section className="bg-white rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="relative h-28 bg-gradient-to-r from-[#4f46e5] via-[#6366f1] to-[#a5b4fc]">
            {profile.coverUrl && <img src={profile.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            {self && (
              <>
                <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadSlot("cover", e.target.files?.[0])} />
                <button type="button" onClick={() => coverInput.current?.click()} className="absolute right-3 bottom-3 px-2.5 py-1 rounded-lg bg-black/45 text-white text-[11px] font-semibold">
                  Edit cover
                </button>
              </>
            )}
          </div>
          <div className="px-5 pb-5">
            <div className="-mt-10 flex items-end justify-between gap-3">
              <div className="relative">
                {profile.profilePicUrl ? (
                  <img src={profile.profilePicUrl} alt="" className="w-[84px] h-[84px] rounded-full object-cover ring-4 ring-white" />
                ) : (
                  <div className="rounded-full ring-4 ring-white"><Avatar name={profile.displayName} size={84} /></div>
                )}
                {self && (
                  <>
                    <input ref={avatarInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadSlot("avatar", e.target.files?.[0])} />
                    <button type="button" onClick={() => avatarInput.current?.click()} className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#4f46e5] text-white flex items-center justify-center shadow">
                      <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                    </button>
                  </>
                )}
              </div>
              {self ? (
                <Link href="/profile" className="px-4 py-1.5 rounded-full border border-[#4f46e5] text-[#4f46e5] text-[13px] font-semibold">Edit profile</Link>
              ) : (
                <div className="flex flex-wrap gap-2 items-center justify-end">
                  <button
                    type="button"
                    disabled={followBusy}
                    className={`px-4 py-1.5 rounded-full text-[13px] font-semibold ${
                      profile.viewerFollows ? "border border-[#c7c4d8] text-[#464555]" : "bg-[#4f46e5] text-white"
                    }`}
                    onClick={async () => {
                      setFollowBusy(true);
                      try {
                        const result = profile.viewerFollows
                          ? await unfollowCampusPerson(token, profile.id)
                          : await followCampusPerson(token, profile.id);
                        setData((prev) => prev ? {
                          ...prev,
                          profile: {
                            ...prev.profile,
                            viewerFollows: result.following,
                            followerCount: Math.max(0, (prev.profile.followerCount ?? 0) + (result.following ? 1 : -1)),
                          },
                        } : prev);
                      } catch (err) {
                        setInviteNote(err instanceof CampusApiError ? err.message : "Could not update follow");
                      } finally {
                        setFollowBusy(false);
                      }
                    }}
                  >
                    {profile.viewerFollows ? "Following" : "Follow"}
                  </button>
                  {myOpenIdeas.length > 0 && (
                    <>
                      <select value={inviteIdea} onChange={(e) => setInviteIdea(e.target.value)} className="rounded-full border border-[#c7c4d8] px-3 py-1.5 text-[12px] max-w-[180px]">
                        {myOpenIdeas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}
                      </select>
                      <button
                        type="button"
                        className="px-4 py-1.5 rounded-full border border-[#4f46e5] text-[#4f46e5] text-[13px] font-semibold"
                        onClick={async () => {
                          try {
                            await invitePerson(token, profile.id, inviteIdea);
                            setInviteNote("Invite sent. It shows in their inbox.");
                          } catch (err) {
                            setInviteNote(err instanceof CampusApiError ? err.message : "Could not invite");
                          }
                        }}
                      >
                        Invite to team
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {inviteNote && <p className="text-[12px] text-[#4f46e5] mt-2 text-right">{inviteNote}</p>}
            <h1 className="mt-3 text-[24px] font-semibold text-[#141b2b]">{profile.displayName}</h1>
            {profile.headline && <p className="text-[15px] text-[#1f2433]">{profile.headline}</p>}
            {study && <p className="text-[13px] text-[#464555] mt-1">{study}</p>}
            {profile.university && (
              <p className="text-[13px] text-[#464555]">
                {profile.university} <span className="text-[11px] font-semibold text-[#15803d]">✓ verified college email</span>
              </p>
            )}
            <p className="text-[12px] text-[#777587] mt-2">
              {profile.followerCount ?? 0} followers · {profile.followingCount ?? 0} following
              {(profile.activityStreak ?? 0) > 0 ? ` · ${profile.activityStreak}-day activity streak` : ""}
            </p>
            <div className="flex flex-wrap gap-3 mt-3 text-[13px]">
              {profile.githubUrl && (
                <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="text-[#4f46e5] hover:underline">
                  GitHub{profile.githubStats ? ` · ${profile.githubStats.publicRepos} repos · ${profile.githubStats.followers} followers` : ""}
                </a>
              )}
              {profile.linkedinUrl && <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="text-[#4f46e5] hover:underline">LinkedIn</a>}
              {profile.siteUrl && <a href={profile.siteUrl} target="_blank" rel="noreferrer" className="text-[#4f46e5] hover:underline">Portfolio</a>}
              {profile.proofPublished && <Link href={`/proof?user=${profile.id}`} className="text-[#4f46e5] hover:underline">Proof page</Link>}
              {self && !profile.proofPublished && <Link href="/proof" className="text-[#4f46e5] hover:underline">Set up proof page</Link>}
            </div>
            {self && stats.signedTasks === 0 && (
              <div className="mt-4 rounded-xl border border-dashed border-[#c7c4d8] bg-[#f9f9ff] p-3">
                <p className="text-[13px] text-[#464555]">No signed lines yet. Join a team, ship a task, and ask the owner to sign — that is your proof.</p>
                <Link href="/ideas" className="inline-block mt-2 text-[13px] font-semibold text-[#4f46e5]">Find an idea →</Link>
              </div>
            )}
            {profile.githubStats && profile.githubStats.topLanguages.length > 0 && (
              <p className="text-[12px] text-[#777587] mt-1">Top languages on GitHub: {profile.githubStats.topLanguages.join(", ")}</p>
            )}
            {profile.circle && <p className="mt-2 inline-block px-2.5 py-1 rounded-full bg-[#eef2ff] text-[#3730a3] text-[12px]">Circle: {profile.circle.label}</p>}
          </div>
        </section>

        <section className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {statTiles.map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl p-3 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <p className="text-[20px] font-semibold text-[#141b2b]">{value}</p>
              <p className="text-[11px] text-[#777587]">{label}</p>
            </div>
          ))}
        </section>

        {(profile.currentlyWorkingOn || currentlyWorking.length > 0) && (
          <Section title="Currently working on">
            {profile.currentlyWorkingOn && <p className="text-[14px] text-[#1f2433] mb-2">{profile.currentlyWorkingOn}</p>}
            {currentlyWorking.length > 0 && (
              <ul className="space-y-2">
                {currentlyWorking.map((row) => (
                  <li key={row.ideaId}>
                    <Link href={`/ideas/${row.ideaId}`} className="text-[13px] font-medium text-[#4f46e5] hover:underline">{row.title}</Link>
                    <p className="text-[11px] text-[#777587]">{row.role} · {row.teamStatus.replace("_", " ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {profile.twoWeekLine && (
          <Section title="About">
            <p className="text-[14px] text-[#1f2433] whitespace-pre-wrap">{profile.twoWeekLine}</p>
            <p className="text-[11px] text-[#777587] mt-1">What they can take on in a two-week sprint</p>
          </Section>
        )}

        <Section title="Signed contributions">
          {signedTrail.length === 0 ? (
            <p className="text-[13px] text-[#777587]">{self ? "Signed tasks will show here after teammates sign your work." : "No signed trail yet."}</p>
          ) : (
            <ul className="space-y-2">
              {signedTrail.map((row) => (
                <li key={row.taskId} className="flex justify-between gap-3 text-[13px]">
                  <div>
                    <p className="font-medium">{row.role || "Task"}</p>
                    <Link href={`/ideas/${row.ideaId}`} className="text-[#4f46e5] hover:underline">{row.ideaTitle}</Link>
                  </div>
                  <span className="text-[11px] text-[#777587] shrink-0">{row.signedAt ? new Date(row.signedAt).toLocaleDateString() : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Experience">
          {profile.experience.length === 0 ? <Empty self={self} text="No experience added yet." cta="+ Add experience" /> : (
            <ul className="space-y-3">
              {profile.experience.map((item) => (
                <li key={`${item.role}-${item.org}`} className="flex gap-3">
                  <span className="w-9 h-9 rounded-lg bg-[#f1f0f7] flex items-center justify-center text-[14px] font-semibold text-[#4f46e5]">Ex</span>
                  <div>
                    <p className="text-[14px] font-semibold">{item.role}</p>
                    <p className="text-[13px] text-[#464555]">{item.org}</p>
                    {item.period && <p className="text-[12px] text-[#777587]">{item.period}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Projects">
          {profile.projects.length === 0 ? <Empty self={self} text="No projects added yet." cta="+ Add a project" /> : (
            <ul className="space-y-3">
              {profile.projects.map((project) => (
                <li key={project.title}>
                  {project.url
                    ? <a href={project.url} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-[#4f46e5] hover:underline">{project.title}</a>
                    : <p className="text-[14px] font-semibold">{project.title}</p>}
                  {project.summary && <p className="text-[13px] text-[#464555]">{project.summary}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Licenses & certifications">
          {profile.certifications.length === 0 ? <Empty self={self} text="No certifications added yet." cta="+ Upload a certificate" /> : (
            <ul className="space-y-3">
              {profile.certifications.map((cert) => (
                <li key={cert.name} className="flex gap-3">
                  <span className="w-9 h-9 rounded-lg bg-[#f1f0f7] flex items-center justify-center text-[14px] font-semibold text-[#4f46e5]">C</span>
                  <div>
                    <p className="text-[14px] font-semibold">{cert.name}</p>
                    <p className="text-[13px] text-[#464555]">{[cert.issuer, cert.year].filter(Boolean).join(" · ")}</p>
                    {cert.url && <a href={cert.url} target="_blank" rel="noreferrer" className="text-[12px] text-[#4f46e5] hover:underline">Show credential</a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Education">
          <p className="text-[14px] font-semibold">{profile.university || "University not set"}</p>
          <p className="text-[13px] text-[#464555]">{[profile.degree, profile.branch].filter(Boolean).join(", ")}</p>
          {profile.graduationYear && <p className="text-[12px] text-[#777587]">Graduating {profile.graduationYear}</p>}
          {self && profile.cgpa !== null && <p className="text-[12px] text-[#464555] mt-1">CGPA {profile.cgpa.toFixed(2)} <span className="text-[#777587]">· only you and idea owners you apply to see this</span></p>}
        </Section>

        <Section title={`Posts · ${stats.ideasPosted}`}>
          {posts.length === 0 ? (
            self ? <Link href="/ideas/new" className="text-[13px] text-[#4f46e5]">+ Post your first idea</Link> : <p className="text-[13px] text-[#777587]">No public ideas yet.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((idea) => (
                <article key={idea.id} className="border-b border-[#f1f0f7] pb-3 last:border-0">
                  <p className="text-[11px] text-[#777587]">{timeAgo(idea.createdAt)} · {idea.stage} · {idea.teamStatus.replace("_", " ")}{idea.hideName ? " · posted with name hidden" : ""}</p>
                  <Link href={`/ideas/${idea.id}`} className="font-serif text-[18px] font-semibold text-[#141b2b] hover:text-[#4f46e5]">{idea.title}</Link>
                  <p className="text-[13px] text-[#464555] mt-0.5 line-clamp-3">{idea.briefLocked ? (idea.blurb || idea.pitch) : idea.pitch}</p>
                  <PostActions token={token} idea={idea} viewerId={user?.id} />
                </article>
              ))}
              {postsCursor && <button type="button" onClick={() => loadMorePosts().catch(() => undefined)} className="text-[13px] font-semibold text-[#4f46e5]">Show more posts</button>}
            </div>
          )}
        </Section>
      </div>

      <aside className="space-y-4">
        {profile.githubUrl && (
          <Section title="GitHub">
            <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-[#4f46e5] hover:underline">
              {profile.githubLogin || "Open profile"}
            </a>
            {profile.githubStats && (
              <p className="text-[12px] text-[#777587] mt-1">
                {profile.githubStats.publicRepos} public repos · {profile.githubStats.followers} followers
              </p>
            )}
          </Section>
        )}

        <Section title="Skills">
          {profile.skills.length === 0 ? <Empty self={self} text="No skills listed." cta="+ Add skills" /> : (
            <ul className="space-y-1.5">
              {profile.skills.map((skill) => (
                <li key={skill.name} className="flex items-center justify-between text-[13px]">
                  <span>{skill.name}</span>
                  {skill.signed
                    ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#15803d]">Signed by a teammate</span>
                    : <span className="text-[10px] text-[#777587]">self-reported</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Interests">
          {profile.interests.length === 0 ? <Empty self={self} text="No interests picked." cta="+ Pick interests" /> : (
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((label) => <span key={label} className="px-2 py-0.5 rounded-full bg-[#f1f0f7] text-[12px] text-[#464555]">{label}</span>)}
            </div>
          )}
        </Section>

        <Section title="Teams worked on">
          {teams.length === 0 ? <p className="text-[13px] text-[#777587]">{self ? "Ask to join an idea from the board." : "Not on a team yet."}</p> : (
            <ul className="space-y-2">
              {teams.map((team) => (
                <li key={team.ideaId}>
                  <Link href={`/ideas/${team.ideaId}`} className="text-[13px] font-medium text-[#141b2b] hover:text-[#4f46e5]">{team.title}</Link>
                  <p className="text-[11px] text-[#777587]">
                    {team.teamStatus.replace("_", " ")} · joined {new Date(team.joinedAt).toLocaleDateString()}{team.leftAt ? " · left" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="text-[11px] text-[#777587] px-1">On Attest since {new Date(profile.joinedAt).toLocaleDateString()}. No DMs — invite to an idea instead.</p>
      </aside>
    </div>
  );
}

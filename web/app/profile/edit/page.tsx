"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getUserProfile,
  updateMyProfile,
  getSkills,
  addMySkill,
  removeMySkill,
  ApiError,
} from "@/lib/api";
import { Skill, ProfileResponse } from "@embedra/types";

export default function EditProfilePage() {
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Profile Form state
  const [bio, setBio] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState("");
  const [github, setGithub] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [website, setWebsite] = useState("");

  // Projects state (list of { title, url })
  const [projectLinksList, setProjectLinksList] = useState<{ id: string; title: string; url: string }[]>([]);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectUrl, setNewProjectUrl] = useState("");

  // Skills state
  const [userSkills, setUserSkills] = useState<{ id: string; name: string }[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillActionError, setSkillActionError] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────
  // Fetch initial profile & skills
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user || !token) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const [profileData, allSkills] = await Promise.all([
          getUserProfile(user!.id, token!),
          getSkills(),
        ]);

        if (isMounted) {
          setBio(profileData.bio || "");
          setProfilePicUrl(profileData.profilePicUrl || "");

          // Parse socials
          if (profileData.socials && typeof profileData.socials === "object") {
            const s = profileData.socials as Record<string, string>;
            setGithub(s.github || "");
            setTwitter(s.twitter || "");
            setLinkedin(s.linkedin || "");
            setWebsite(s.website || "");
          }

          // Parse project links
          if (profileData.projectLinks && typeof profileData.projectLinks === "object") {
            const p = profileData.projectLinks as Record<string, string>;
            const mapped = Object.entries(p).map(([title, url], idx) => ({
              id: `proj-${idx}-${Date.now()}`,
              title,
              url,
            }));
            setProjectLinksList(mapped);
          }

          setUserSkills(profileData.skills || []);
          setAvailableSkills(allSkills);
          if (allSkills.length > 0) {
            setSelectedSkillId(allSkills[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load profile for editing");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user, token, isAuthLoading]);

  // ──────────────────────────────────────────────────────────────
  // Skill Management: Add
  // ──────────────────────────────────────────────────────────────
  const handleAddSkill = async () => {
    if (!selectedSkillId || !token || isAddingSkill) return;
    try {
      setIsAddingSkill(true);
      setSkillActionError(null);

      const added = await addMySkill(selectedSkillId, token);
      const skillObj = availableSkills.find((s) => s.id === selectedSkillId);
      if (skillObj) {
        setUserSkills((prev) => [...prev, { id: skillObj.id, name: skillObj.name }]);
      }
    } catch (err: any) {
      setSkillActionError(err.message || "Failed to add skill");
    } finally {
      setIsAddingSkill(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Skill Management: Remove
  // ──────────────────────────────────────────────────────────────
  const handleRemoveSkill = async (skillId: string) => {
    if (!token) return;
    try {
      setSkillActionError(null);
      await removeMySkill(skillId, token);
      setUserSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch (err: any) {
      setSkillActionError(err.message || "Failed to remove skill");
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Project Links Management
  // ──────────────────────────────────────────────────────────────
  const handleAddProject = () => {
    const t = newProjectTitle.trim();
    const u = newProjectUrl.trim();
    if (!t || !u) return;

    setProjectLinksList((prev) => [...prev, { id: `proj-${Date.now()}`, title: t, url: u }]);
    setNewProjectTitle("");
    setNewProjectUrl("");
  };

  const handleRemoveProject = (id: string) => {
    setProjectLinksList((prev) => prev.filter((p) => p.id !== id));
  };

  // ──────────────────────────────────────────────────────────────
  // Save Profile Changes
  // ──────────────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      // Assemble socials dictionary
      const socialsObj: Record<string, string> = {};
      if (github.trim()) socialsObj.github = github.trim();
      if (twitter.trim()) socialsObj.twitter = twitter.trim();
      if (linkedin.trim()) socialsObj.linkedin = linkedin.trim();
      if (website.trim()) socialsObj.website = website.trim();

      // Assemble project links dictionary
      const projectsObj: Record<string, string> = {};
      for (const p of projectLinksList) {
        if (p.title.trim() && p.url.trim()) {
          projectsObj[p.title.trim()] = p.url.trim();
        }
      }

      await updateMyProfile(
        {
          bio: bio.trim() || null,
          profilePicUrl: profilePicUrl.trim() || null,
          socials: Object.keys(socialsObj).length > 0 ? socialsObj : null,
          projectLinks: Object.keys(projectsObj).length > 0 ? projectsObj : null,
        },
        token
      );

      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => {
        router.push(`/profile/${user.id}`);
      }, 700);
    } catch (err: any) {
      setError(err.message || "Failed to save profile changes");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter skills not yet added
  const remainingSkills = availableSkills.filter(
    (s) => !userSkills.some((us) => us.id === s.id)
  );

  // ──────────────────────────────────────────────────────────────
  // Unauthenticated Guard
  // ──────────────────────────────────────────────────────────────
  if (!isAuthLoading && !user) {
    return (
      <main className="max-w-md mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 space-y-4 card-elevation">
          <h1 className="text-xl font-bold text-slate-900">Sign In Required</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            You must be signed in to edit your user profile and manage your skills.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all duration-150 active:scale-[0.98]"
            >
              ← Return to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Loading skeleton
  // ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="h-4 w-32 bg-slate-200/70 animate-pulse rounded-md" />
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 space-y-6 card-elevation animate-pulse">
          <div className="h-8 w-1/3 bg-slate-200 rounded-lg" />
          <div className="h-24 w-full bg-slate-100 rounded-xl" />
        </div>
      </main>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Edit Profile Form
  // ──────────────────────────────────────────────────────────────
  return (
    <main className="max-w-3xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">

      {/* ── Breadcrumbs ── */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <Link href="/" className="hover:text-slate-900 transition-colors duration-150">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <Link
          href={`/profile/${user?.id}`}
          className="hover:text-slate-900 transition-colors duration-150 truncate max-w-[200px]"
        >
          @{user?.username}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-800 font-medium">Edit Profile</span>
      </div>

      {/* ── Page Header ── */}
      <div className="space-y-1.5 border-b border-slate-200/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Edit Profile
        </h1>
        <p className="text-sm text-slate-500">
          Manage your identity, bio description, verified skills, and project links.
        </p>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-start space-x-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── Form Container ── */}
      <form onSubmit={handleSaveProfile} className="space-y-8">

        {/* Basic Info Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 card-elevation space-y-5">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Personal Details</h2>

          {/* Profile Picture URL */}
          <div className="space-y-2">
            <label htmlFor="profile-pic-url" className="block text-xs font-semibold text-slate-800">
              Avatar Image URL
            </label>
            <div className="flex items-center space-x-4">
              {profilePicUrl ? (
                <img
                  src={profilePicUrl}
                  alt="Preview"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 shrink-0">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <input
                id="profile-pic-url"
                type="url"
                value={profilePicUrl}
                onChange={(e) => setProfilePicUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="flex-1 px-3.5 py-2.5 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-150"
              />
            </div>
            <p className="text-[11px] text-slate-400">Direct link to a public image (PNG, JPG, WebP).</p>
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="profile-bio" className="block text-xs font-semibold text-slate-800">
                Bio Description
              </label>
              <span className={`text-[11px] ${bio.length > 2000 ? "text-rose-600 font-bold" : "text-slate-400"}`}>
                {bio.length}/2000
              </span>
            </div>
            <textarea
              id="profile-bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other builders about your background, interests, and technical strengths…"
              className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-150"
            />
          </div>
        </div>

        {/* Skill Management Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 card-elevation space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Functional Skills</h2>
            <p className="text-xs text-slate-500">
              Select verified skills to showcase your formation capabilities.
            </p>
          </div>

          {/* Inline Skill Error */}
          {skillActionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
              <span>{skillActionError}</span>
              <button
                type="button"
                onClick={() => setSkillActionError(null)}
                className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Current Skills Chips */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Attached Skills</label>
            {userSkills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userSkills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 bg-violet-50 border border-violet-200/80 text-violet-800 text-xs font-semibold rounded-lg shadow-2xs"
                  >
                    <span>{skill.name}</span>
                    <button
                      type="button"
                      id={`remove-skill-${skill.id}`}
                      onClick={() => handleRemoveSkill(skill.id)}
                      className="text-violet-400 hover:text-violet-700 hover:bg-violet-100 rounded p-0.5 transition-colors cursor-pointer"
                      title="Remove skill"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No skills attached yet. Select a skill below to add.</p>
            )}
          </div>

          {/* Add Skill Dropdown (IdeaForm pattern) */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label htmlFor="skill-picker" className="block text-xs font-semibold text-slate-700">
              Add New Skill
            </label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <select
                  id="skill-picker"
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                  disabled={remainingSkills.length === 0}
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs sm:text-sm text-slate-900 appearance-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {remainingSkills.length === 0 ? (
                    <option value="">All available skills attached</option>
                  ) : (
                    remainingSkills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <button
                type="button"
                id="add-skill-button"
                disabled={isAddingSkill || remainingSkills.length === 0 || !selectedSkillId}
                onClick={handleAddSkill}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-semibold rounded-xl shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                {isAddingSkill ? "Adding…" : "+ Add Skill"}
              </button>
            </div>
          </div>
        </div>

        {/* Social Handles Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 card-elevation space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Social Channels</h2>
            <p className="text-xs text-slate-500">Links to your public developer profiles.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="social-github" className="block text-xs font-semibold text-slate-700">GitHub</label>
              <input
                id="social-github"
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="github.com/username"
                className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="social-twitter" className="block text-xs font-semibold text-slate-700">Twitter / X</label>
              <input
                id="social-twitter"
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="x.com/username"
                className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="social-linkedin" className="block text-xs font-semibold text-slate-700">LinkedIn</label>
              <input
                id="social-linkedin"
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="linkedin.com/in/username"
                className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-150"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="social-website" className="block text-xs font-semibold text-slate-700">Website / Portfolio</label>
              <input
                id="social-website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full px-3 py-2 bg-slate-50/70 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all duration-150"
              />
            </div>
          </div>
        </div>

        {/* Project Links Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 card-elevation space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Project Artifacts</h2>
            <p className="text-xs text-slate-500">Showcase active repositories or live deployments.</p>
          </div>

          {/* Existing Project Links List */}
          {projectLinksList.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {projectLinksList.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 bg-slate-50/50">
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.title}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{p.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(p.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-1 cursor-pointer"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Add Project Inline Form */}
          <div className="p-3 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Project Title (e.g. Distributed Engine)"
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="url"
                value={newProjectUrl}
                onChange={(e) => setNewProjectUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={handleAddProject}
                disabled={!newProjectTitle.trim() || !newProjectUrl.trim()}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-xs transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
              >
                + Add Project Link
              </button>
            </div>
          </div>
        </div>

        {/* ── Form Action Buttons ── */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <Link
            href={`/profile/${user?.id}`}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-2xs transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow-[0_4px_12px_rgba(79,70,229,0.25)] transition-all duration-150 ease-out active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Saving Changes…</span>
              </>
            ) : (
              <span>Save Profile Changes</span>
            )}
          </button>
        </div>

      </form>
    </main>
  );
}

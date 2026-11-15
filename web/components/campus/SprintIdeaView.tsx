"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  createOffer,
  deleteSprintIdeaImage,
  fileReport,
  getSprintIdea,
  similarSprintIdeas,
  uploadSprintIdeaImage,
  type SprintIdea,
  CampusApiError,
} from "@/lib/campus-api";
import { resizeImage } from "@/lib/resize-image";
import PostActions from "./PostActions";
import { Avatar, timeAgo } from "./CommentThread";
import { useReadTracking } from "@/lib/use-read-tracking";
import DealBadge from "./DealBadge";
import CampusChips from "./CampusChips";

function seatBadge(idea: SprintIdea) {
  if (idea.teamStatus === "shipped") return { label: "IDEA · SHIPPED", open: false };
  if (idea.seatsOpen === false || idea.teamStatus !== "open") return { label: "IDEA · TEAM FULL", open: false };
  return { label: "IDEA · OPEN", open: true };
}

const DAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SprintIdeaView({ ideaId }: { ideaId: string }) {
  const { token, user } = useAuth();
  const [idea, setIdea] = useState<SprintIdea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [hours, setHours] = useState(4);
  const [days, setDays] = useState<string[]>(["Sat", "Sun"]);
  const [links, setLinks] = useState("");
  const [skills, setSkills] = useState("");
  const [phases, setPhases] = useState("");
  const [whyFit, setWhyFit] = useState("");
  const [sent, setSent] = useState(false);
  const [similar, setSimilar] = useState<(SprintIdea & { topics: string[] })[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!token) return;
    const data = await getSprintIdea(token, ideaId);
    setIdea(data.idea);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [token, ideaId]);

  useEffect(() => {
    if (!token) return;
    similarSprintIdeas(token, ideaId).then((data) => setSimilar(data.ideas)).catch(() => setSimilar([]));
  }, [token, ideaId]);

  useReadTracking(token, ideaId, Boolean(idea && user && idea.ownerId !== user.id));

  if (!idea) return <div className="px-5 py-10 text-[14px] text-[#777587]">{error || "Loading the brief…"}</div>;
  const mine = user?.id === idea.ownerId;
  const seat = seatBadge(idea);
  const published = idea.publishedAt || idea.createdAt;
  const imageCount = idea.images?.length ?? 0;

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const addImage = async (file: File | undefined) => {
    if (!file || !token) return;
    setImageBusy(true);
    setError(null);
    try {
      const resized = await resizeImage(file);
      await uploadSprintIdeaImage(token, idea.id, resized);
      await load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setImageBusy(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  const removeImage = async (imageId: string) => {
    if (!token) return;
    setImageBusy(true);
    try {
      await deleteSprintIdeaImage(token, idea.id, imageId);
      await load();
    } catch (err) {
      setError(err instanceof CampusApiError ? err.message : "Could not delete image");
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-4xl mx-auto space-y-6">
      <Link href="/ideas" className="inline-flex text-[12px] font-medium text-[#777587] hover:text-[#4f46e5]">← Ideas</Link>

      {mine && (
        <section className="rounded-xl border border-[#e0e7ff] bg-[#f8f9ff] p-4 flex flex-wrap gap-2 items-center">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#4f46e5] w-full sm:w-auto sm:mr-2">Owner tools</p>
          <Link href="/inbox" className="px-3 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold">
            Review join requests
          </Link>
          <Link href={`/ideas/${idea.id}/work`} className="px-3 py-2 rounded-lg border border-[#4f46e5]/40 text-[#4f46e5] text-[13px] font-semibold bg-white">
            Open workspace
          </Link>
          <span className="text-[12px] text-[#777587]">
            {seat.label}
            {typeof idea.collaboratorCount === "number" ? ` · ${idea.collaboratorCount}/${(idea.teamMax ?? 6) - 1} seats` : ""}
          </span>
        </section>
      )}

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${seat.open ? "bg-[#eef2ff] text-[#3730a3]" : "bg-[#f1f0f7] text-[#777587]"}`}>
            {seat.label}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-[#777587]">
            {idea.visibility || "standard"}
            {idea.stage !== "idea" ? ` · ${idea.stage}` : ""}
            {idea.authorBranch ? ` · ${idea.authorBranch}` : ""}
            {idea.authorSemester ? ` Sem ${idea.authorSemester}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={idea.hideName ? "?" : idea.authorName || "?"} size={44} />
          <div>
            {idea.hideName ? (
              <p className="text-[14px] font-semibold">Name hidden</p>
            ) : (
              <Link href={`/profile/${idea.ownerId}`} className="text-[14px] font-semibold hover:underline">{idea.authorName}</Link>
            )}
            <p className="text-[12px] text-[#777587]">
              First published {new Date(published).toLocaleString()} · {timeAgo(idea.createdAt)}
            </p>
          </div>
        </div>
        <h1 className="font-serif text-[36px] sm:text-[42px] font-semibold leading-[1.15] tracking-tight text-[#141b2b]">{idea.title}</h1>
        {idea.problemSource && (
          <p className="text-[13px] text-[#464555]">
            Based on <Link href={`/problems/${idea.problemSource.id}`} className="font-semibold text-[#b45309] hover:underline">{idea.problemSource.title}</Link>
            {idea.problemSource.reporterName ? ` · Problem raised by ${idea.problemSource.reporterName}` : " · Reporter chose to hide their name"}
          </p>
        )}
        {idea.images && idea.images.length > 0 && (
          <div className="space-y-2">
            {idea.images.filter((img) => img.role === "hero").map((img) => (
              <div key={img.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.imageUrl} alt="" className="w-full max-h-[420px] object-cover rounded-xl" />
                {mine && (
                  <button type="button" disabled={imageBusy} onClick={() => removeImage(img.id)} className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/50 text-white text-[11px] font-semibold">
                    Remove
                  </button>
                )}
              </div>
            ))}
            {idea.images.some((img) => img.role === "figure") && (
              <div className="grid grid-cols-2 gap-2">
                {idea.images.filter((img) => img.role === "figure").map((img) => (
                  <div key={img.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt="" className="w-full h-40 object-cover rounded-lg" />
                    {mine && (
                      <button type="button" disabled={imageBusy} onClick={() => removeImage(img.id)} className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/50 text-white text-[11px] font-semibold">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-[18px] leading-relaxed text-[#464555]">
          {idea.briefLocked ? (idea.blurb || "Short teaser — full brief unlocks after you are accepted.") : idea.pitch}
        </p>
        {idea.helpNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {idea.helpNeeded.map((role) => (
              <span key={role} className="px-2.5 py-1 rounded-full text-[12px] bg-[#eef2ff] text-[#3730a3]">{role}</span>
            ))}
          </div>
        )}
      </header>

      {mine && token && (
        <section className="rounded-xl border border-dashed border-[#c7c4d8] bg-white p-4 space-y-2">
          <p className="text-[13px] font-semibold">Photos for this idea · {imageCount}/3</p>
          <p className="text-[12px] text-[#777587]">First image is the hero on the Ideas feed. PNG, JPG or WebP under 5 MB (we compress large photos).</p>
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => addImage(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={imageBusy || imageCount >= 3}
            onClick={() => imageInput.current?.click()}
            className="px-3 py-2 rounded-lg border border-[#4f46e5] text-[#4f46e5] text-[13px] font-semibold disabled:opacity-50"
          >
            {imageBusy ? "Uploading…" : imageCount >= 3 ? "Photo cap reached" : "Add photo"}
          </button>
        </section>
      )}

      <div className="sticky top-16 z-10 -mx-1 px-1 py-2 bg-[#f9f9ff]/90 backdrop-blur border-y border-[#eceaf4]">
        {token && <PostActions token={token} idea={idea} viewerId={user?.id} commentsOpen />}
      </div>

      {idea.briefLocked ? (
        <div className="rounded-xl border border-[#e0e7ff] bg-[#eef2ff]/60 p-5 space-y-2">
          <p className="text-[13px] font-semibold text-[#3730a3]">Full brief is gated</p>
          <p className="text-[14px] text-[#464555] leading-relaxed">
            The owner set this card to minimal visibility. Ask to collaborate with what you can own — if they accept, you unlock the full brief, private approach, and workspace.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-[15px] leading-relaxed text-[#1f2433]">
          {idea.audience && <p><span className="text-[#777587]">For </span>{idea.audience}</p>}
          {idea.ships && <p><span className="text-[#777587]">In two weeks </span>{idea.ships}</p>}
          {idea.gap && <p><span className="text-[#777587]">Still missing </span>{idea.gap}</p>}
          <p>
            <span className="text-[#777587]">Team </span>
            {idea.teamStatus.replace("_", " ")}
            {idea.isSmall ? ` · small, ${idea.hourCap}h cap` : ""}
            {typeof idea.collaboratorCount === "number" ? ` · ${idea.collaboratorCount}/${(idea.teamMax ?? 6) - 1} seats filled` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <DealBadge dealType={idea.dealType} currency={idea.currency} budgetMinor={idea.budgetMinor} licence={idea.licence} />
            <CampusChips sameCampus={idea.sameCampus} campusOnly={idea.campusOnly} />
          </div>
          {idea.compensationSentence && <p>{idea.compensationSentence}</p>}
          {idea.problemTitle && <p className="text-[13px] text-[#4f46e5]">From a problem: {idea.problemTitle}</p>}
          {idea.duplicateOfId && <p className="text-[13px] text-[#777587]">Remix of another card. Only the public slice was copied; private notes were not.</p>}
          {(idea.forkCount ?? 0) > 0 && <p className="text-[13px] text-[#777587]">{idea.forkCount} {idea.forkCount === 1 ? "remix" : "remixes"} of this brief</p>}
        </div>
      )}

      {idea.approach && (
        <div className="rounded-xl bg-[#f1f3ff] p-5">
          <p className="text-[12px] font-semibold text-[#4f46e5]">
            {idea.isMember ? "Unlocked notes" : "Public approach (open visibility)"}
          </p>
          <p className="text-[14px] mt-2 whitespace-pre-wrap leading-relaxed">{idea.approach.body}</p>
          {idea.approach.contactEmail && (
            <p className="text-[12px] mt-3 text-[#464555]">{idea.approach.contactEmail}</p>
          )}
        </div>
      )}

      {idea.isMember && (
        <Link href={`/ideas/${idea.id}/work`} className="inline-block px-4 py-2.5 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold">
          Open workspace
        </Link>
      )}

      {!mine && !idea.isMember && token && seat.open && (
        <form
          id="apply"
          className="scroll-mt-24 bg-white rounded-xl p-5 sm:p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[#eceaf4]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!token) return;
            if (days.length === 0) {
              setError("Pick at least one day you can work");
              return;
            }
            if (skills.trim().length < 2) {
              setError("List at least one skill you bring");
              return;
            }
            setError(null);
            try {
              const plan = [
                body.trim(),
                whyFit.trim() ? `\n\nWhy I fit: ${whyFit.trim()}` : "",
              ].join("");
              await createOffer(token, {
                ideaId: idea.id,
                body: plan,
                hoursPerWeek: Number(hours),
                availableDays: days,
                links: links.split(/\s+/).filter(Boolean),
                skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
                phases: phases.split(",").map((s) => s.trim()).filter(Boolean),
              });
              setSent(true);
            } catch (err) {
              setError(err instanceof CampusApiError ? err.message : "Could not send");
            }
          }}
        >
          <div>
            <p className="text-[16px] font-semibold">Ask to collaborate</p>
            <p className="text-[13px] text-[#777587] mt-1">
              Owners decide from this form + your profile. Be concrete — vague “I can help” requests get declined.
            </p>
          </div>

          <label className="block text-[12px] font-medium text-[#464555]">
            What you will own in the next 14 days <span className="text-[#ba1a1a]">*</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={12}
              rows={3}
              placeholder="e.g. Build the ESP32 sensor firmware and a basic reading page"
              className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
            />
          </label>

          <label className="block text-[12px] font-medium text-[#464555]">
            Skills you bring <span className="text-[#ba1a1a]">*</span>
            <input
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              required
              placeholder="React, ESP32, Figma — comma separated"
              className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
            />
          </label>

          <label className="block text-[12px] font-medium text-[#464555]">
            Phases / roles you want
            <input
              value={phases}
              onChange={(e) => setPhases(e.target.value)}
              placeholder="backend, UI, hardware, writeup"
              className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
            />
          </label>

          <label className="block text-[12px] font-medium text-[#464555]">
            Why you fit this brief
            <textarea
              value={whyFit}
              onChange={(e) => setWhyFit(e.target.value)}
              rows={2}
              placeholder="One or two lines — related course work, past project, signed proof"
              className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#464555]">
              Hours / week <span className="text-[#ba1a1a]">*</span>
              <input
                type="number"
                min={1}
                max={40}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                required
                className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
              />
            </label>
            <div>
              <p className="text-[12px] font-medium text-[#464555]">Days available <span className="text-[#ba1a1a]">*</span></p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                      days.includes(day)
                        ? "bg-[#4f46e5] border-[#4f46e5] text-white"
                        : "border-[#c7c4d8] text-[#464555] hover:bg-[#f1f0f7]"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="block text-[12px] font-medium text-[#464555]">
            Portfolio / proof links
            <input
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="GitHub, Figma, Drive — space separated URLs"
              className="mt-1 w-full rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
            />
          </label>

          <p className="text-[12px] text-[#777587]">
            Your Attest profile (skills, projects, signed work) is attached automatically. You will not see private notes until they accept.
          </p>

          {sent ? (
            <p className="text-[13px] text-[#15803d] font-medium">Request sent — watch Inbox for their decision.</p>
          ) : (
            <button className="px-4 py-2.5 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold" type="submit">
              Send join request
            </button>
          )}
        </form>
      )}

      {!mine && !idea.isMember && !seat.open && (
        <p className="text-[14px] text-[#777587]">This team is full or not open for new requests. You can still Start my version from the bar above.</p>
      )}

      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}

      {token && (
        <div className="flex gap-4 text-[12px] text-[#777587]">
          <button type="button" className="hover:text-[#ba1a1a]" onClick={() => fileReport(token, "idea", idea.id, "spam").then(() => setError("Reported. The card is hidden until an admin reviews it."))}>Report spam</button>
          <button type="button" className="hover:text-[#ba1a1a]" onClick={() => fileReport(token, "idea", idea.id, "copied work").then(() => setError("Reported as copied work."))}>Report copied work</button>
        </div>
      )}

      {similar.length > 0 && (
        <section className="pt-2 space-y-3 border-t border-[#eceaf4]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#777587]">More like this</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {similar.map((row) => (
              <Link key={row.id} href={`/ideas/${row.id}`} className="block bg-white rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow">
                <p className="font-serif text-[17px] font-semibold text-[#141b2b] leading-snug">{row.title}</p>
                <p className="text-[13px] text-[#464555] mt-1.5 line-clamp-2">{row.blurb || row.pitch}</p>
                {row.topics.length > 0 && <p className="text-[11px] text-[#4f46e5] mt-2">{row.topics.join(" · ")}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

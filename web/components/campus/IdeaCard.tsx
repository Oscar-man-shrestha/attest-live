"use client";

import React from "react";
import Link from "next/link";
import type { FeedIdea, SprintIdea } from "@/lib/campus-api";
import PostActions from "./PostActions";
import { Avatar, timeAgo } from "./CommentThread";
import DealBadge from "./DealBadge";
import CampusChips from "./CampusChips";

export type IdeaCardIdea = SprintIdea & Partial<Pick<FeedIdea, "reasons" | "topics">>;

function stageLabel(stage: string) {
  if (stage === "idea") return null;
  if (stage === "prototype") return "Prototype";
  if (stage === "building") return "Building";
  if (stage === "launched") return "Launched";
  return stage;
}

function seatLabel(idea: IdeaCardIdea) {
  if (idea.teamStatus === "shipped") return { text: "SHIPPED", tone: "text-[#15803d]" };
  if (idea.seatsOpen === false || idea.teamStatus !== "open") return { text: "TEAM FULL", tone: "text-[#777587]" };
  return { text: "OPEN", tone: "text-[#4f46e5]" };
}

type Props = {
  idea: IdeaCardIdea;
  token?: string | null;
  viewerId?: string;
  feedCard?: boolean;
  onNotInterested?: () => void;
  onSavedChange?: (saved: boolean) => void;
};

export default function IdeaCard({ idea, token, viewerId, feedCard = false, onNotInterested, onSavedChange }: Props) {
  const hero = idea.images?.find((img) => img.role === "hero");
  const seat = seatLabel(idea);
  const stage = stageLabel(idea.stage);
  const visibility = idea.visibility || "standard";

  return (
    <article className="group bg-white rounded-2xl overflow-hidden border border-[#eceaf4] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(79,70,229,0.1)] transition-shadow duration-200">
      {hero && (
        <Link href={`/ideas/${idea.id}`} className="block relative w-full aspect-[21/9] bg-[#f1f0f7] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        </Link>
      )}

      <div className="p-5 sm:p-6 space-y-3">
        {feedCard && idea.reasons && idea.reasons.length > 0 && (
          <p className="text-[12px] font-medium text-[#4f46e5]">{idea.reasons.join(" · ")}</p>
        )}

        <div className="flex items-center gap-2.5">
          <Avatar name={idea.hideName ? "?" : idea.authorName || "?"} size={40} />
          <div className="min-w-0 flex-1">
            {idea.hideName ? (
              <p className="text-[14px] font-semibold">Name hidden</p>
            ) : (
              <Link href={`/profile/${idea.ownerId}`} className="text-[14px] font-semibold hover:underline">
                {idea.authorName}
              </Link>
            )}
            <p className="text-[12px] text-[#777587]">
              {[idea.authorBranch, idea.authorSemester ? `Sem ${idea.authorSemester}` : null, timeAgo(idea.createdAt)].filter(Boolean).join(" · ")}
            </p>
          </div>
          {feedCard && onNotInterested && (
            <button type="button" className="text-[12px] text-[#777587] shrink-0 hover:text-[#141b2b]" onClick={onNotInterested}>
              Not interested
            </button>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-[#777587] flex flex-wrap gap-x-1.5">
            <span className="text-[#4f46e5] font-semibold">IDEA</span>
            <span>·</span>
            <span className={`font-semibold ${seat.tone}`}>{seat.text}</span>
            <span>·</span>
            <span>{visibility}</span>
            {stage && (
              <>
                <span>·</span>
                <span>{stage}</span>
              </>
            )}
            {typeof idea.collaboratorCount === "number" && idea.collaboratorCount > 0 && (
              <>
                <span>·</span>
                <span>{idea.collaboratorCount}/{(idea.teamMax ?? 6) - 1} on team</span>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <DealBadge dealType={idea.dealType} currency={idea.currency} budgetMinor={idea.budgetMinor} licence={idea.licence} />
            <CampusChips sameCampus={idea.sameCampus} campusOnly={idea.campusOnly} />
          </div>

          <Link
            href={`/ideas/${idea.id}`}
            className="block font-serif text-[24px] sm:text-[28px] font-semibold leading-snug text-[#141b2b] hover:text-[#4f46e5] transition-colors"
          >
            {idea.title}
          </Link>

          <p className="text-[15px] sm:text-[16px] leading-relaxed text-[#464555] line-clamp-3">
            {idea.briefLocked
              ? (idea.blurb || "Teaser — full brief unlocks after accept")
              : (idea.pitch || idea.blurb)}
          </p>

          {idea.briefLocked && (
            <p className="text-[12px] text-[#777587]">Minimal visibility — open the card and ask to join to unlock the full brief.</p>
          )}
          {idea.problemTitle && (
            <p className="text-[13px] text-[#4f46e5]">From problem: {idea.problemTitle}</p>
          )}
          {idea.forkedFromId && (
            <p className="text-[12px] text-[#777587]">Someone&apos;s remix of a public brief — private notes were not copied.</p>
          )}

          {idea.topics && idea.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {idea.topics.map((topic) => (
                <span key={topic} className="px-2.5 py-0.5 rounded-full text-[12px] bg-[#f1f0f7] text-[#464555]">{topic}</span>
              ))}
            </div>
          )}
          {idea.helpNeeded.length > 0 && (
            <p className="text-[13px] text-[#777587]">Needs {idea.helpNeeded.join(", ")}</p>
          )}
        </div>

        {(idea.engagement?.likes || idea.engagement?.comments || idea.engagement?.shares || idea.forkCount) ? (
          <p className="text-[12px] text-[#777587]">
            {[
              idea.engagement?.likes ? `${idea.engagement.likes} ${idea.engagement.likes === 1 ? "like" : "likes"}` : null,
              idea.engagement?.comments ? `${idea.engagement.comments} ${idea.engagement.comments === 1 ? "comment" : "comments"}` : null,
              idea.engagement?.shares ? `${idea.engagement.shares} ${idea.engagement.shares === 1 ? "share" : "shares"}` : null,
              idea.forkCount ? `${idea.forkCount} ${idea.forkCount === 1 ? "remix" : "remixes"}` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Link
            href={`/ideas/${idea.id}#apply`}
            className="inline-flex px-3.5 py-2 rounded-lg bg-[#4f46e5] text-white text-[13px] font-semibold hover:bg-[#4338ca] transition-colors"
          >
            {seat.text === "OPEN" ? "Ask to join" : "View brief"}
          </Link>
          <Link
            href={`/ideas/${idea.id}`}
            className="inline-flex px-3.5 py-2 rounded-lg border border-[#c7c4d8] text-[13px] font-semibold text-[#141b2b] hover:bg-[#f8f9ff] transition-colors"
          >
            Read more
          </Link>
        </div>

        {token && (
          <PostActions
            token={token}
            idea={idea}
            viewerId={viewerId}
            hideSummary
            onSavedChange={onSavedChange}
          />
        )}
      </div>
    </article>
  );
}

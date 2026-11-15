import Link from "next/link";
import type { Gig } from "@/lib/campus-api";
import CampusChips from "./CampusChips";
import { timeAgo } from "./CommentThread";

/** A gig shown as a tear-off ticket: stub (who/what) above the tear, price below. */
export default function GigTicket({ gig }: { gig: Gig }) {
  const request = gig.kind === "request";
  return (
    <Link href={`/gigs/${gig.id}`} className="ticket card-lift block hover:border-[#9bd9bd]">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="serial text-[#047857]">{request ? "Needs doing" : "Service"} · {gig.category}</span>
          <span className="serial">{timeAgo(gig.createdAt)}</span>
        </div>
        <p className="mt-1.5 font-serif text-[19px] font-semibold leading-snug text-[#141b2b]">{gig.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#464555] line-clamp-2">{gig.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-[#777587]">@{gig.author.handle}</span>
          <CampusChips sameCampus={gig.sameCampus} campusOnly={gig.campusOnly} />
          {gig.status === "closed" && <span className="rounded-full bg-[#f5f5f4] px-2 py-0.5 text-[11px] font-semibold text-[#57534e]">Closed</span>}
        </div>
      </div>
      <div className="ticket-tear" />
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="serial">{gig.paid ? (request ? "Pays" : "Price") : "Reward"}</p>
          <p className={`ledger text-[18px] font-bold ${gig.paid ? "text-[#047857]" : "text-[#464555]"}`}>{gig.price ?? "Credit + proof"}</p>
        </div>
        <div className="text-right">
          {gig.deliveryDays ? <p className="serial">{gig.deliveryDays} day{gig.deliveryDays === 1 ? "" : "s"}</p> : null}
          {gig.mine && typeof gig.responseCount === "number" && gig.responseCount > 0 ? (
            <p className="text-[12px] font-semibold text-[#b45309]">{gig.responseCount} new response{gig.responseCount === 1 ? "" : "s"}</p>
          ) : (
            <p className="text-[12px] font-semibold text-[#047857]">{gig.mine ? "Your gig" : request ? "I can do this →" : "Request this →"}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

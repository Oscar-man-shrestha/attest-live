"use client";

import { DEAL_TYPE_LABELS, formatMoney, isPaidDeal, type DealType } from "@embedra/types";

/** Small pill that says how a project rewards builders: paid amount, licence, or credit. */
export default function DealBadge({
  dealType,
  currency,
  budgetMinor,
  licence,
  className = "",
}: {
  dealType?: string | null;
  currency?: string | null;
  budgetMinor?: number | null;
  licence?: string | null;
  className?: string;
}) {
  if (!dealType) return null;
  const paid = isPaidDeal(dealType);
  const label = DEAL_TYPE_LABELS[dealType as DealType] ?? dealType;
  const money = paid ? formatMoney(budgetMinor ?? null, currency ?? null) : null;
  const detail = money ?? (dealType === "open_source" && licence ? licence : null);
  const tone = paid
    ? "bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]"
    : dealType === "open_source"
      ? "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]"
      : "bg-[#f5f5f4] text-[#57534e] border-[#e7e5e4]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`}>
      <span className="material-symbols-outlined text-[13px]" aria-hidden>{paid ? "payments" : dealType === "open_source" ? "code" : "handshake"}</span>
      {label}
      {detail ? <span className="font-normal">· {detail}</span> : null}
    </span>
  );
}

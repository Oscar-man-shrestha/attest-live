import React from "react";
import Link from "next/link";

type Props = {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
};

export default function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  onAction,
  secondaryHref,
  secondaryLabel,
  onSecondaryAction,
}: Props) {
  const hasPrimary = Boolean(actionLabel && (actionHref || onAction));
  const hasSecondary = Boolean(secondaryLabel && (secondaryHref || onSecondaryAction));

  return (
    <div className="rounded-2xl border border-[#e0e7ff] bg-gradient-to-b from-[#f8f9ff] to-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <p className="font-serif text-[22px] sm:text-[24px] font-semibold text-[#141b2b]">{title}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-[#464555] max-w-md mx-auto">{body}</p>
      {(hasPrimary || hasSecondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {hasPrimary && (
            actionHref ? (
              <Link
                href={actionHref}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[13px] font-semibold transition-colors active:scale-[0.98]"
              >
                {actionLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onAction}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[13px] font-semibold transition-colors active:scale-[0.98]"
              >
                {actionLabel}
              </button>
            )
          )}
          {hasSecondary && (
            secondaryHref ? (
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-[#c7c4d8] bg-white hover:bg-[#f8f7fc] text-[#141b2b] text-[13px] font-semibold transition-colors"
              >
                {secondaryLabel}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-[#c7c4d8] bg-white hover:bg-[#f8f7fc] text-[#141b2b] text-[13px] font-semibold transition-colors"
              >
                {secondaryLabel}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

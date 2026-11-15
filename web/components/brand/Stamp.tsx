import React from "react";

type Tone = "money" | "ink" | "amber" | "red" | "muted";
const TONE: Record<Tone, string> = { money: "", ink: "stamp-ink", amber: "stamp-amber", red: "stamp-red", muted: "stamp-muted" };

/**
 * Ink-stamp badge. Use only for states someone else verified: a teammate's signature,
 * a payment both sides confirmed, a verified university email. Never for self-claims.
 */
export default function Stamp({
  children,
  tone = "money",
  flat = false,
  large = false,
  thunk = false,
  icon,
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  flat?: boolean;
  large?: boolean;
  thunk?: boolean;
  icon?: string;
  className?: string;
}) {
  return (
    <span className={`stamp ${TONE[tone]} ${flat ? "stamp-flat" : ""} ${large ? "stamp-lg" : ""} ${thunk ? "stamp-thunk" : ""} ${className}`}>
      {icon && <span className="material-symbols-outlined" style={{ fontSize: "1.25em" }} aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}

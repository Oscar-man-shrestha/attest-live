"use client";

import { useCallback, useEffect, useState } from "react";

export type CampusScope = "campus" | "all";
const KEY = "attest_scope";

/** Remembers the viewer's last choice between their own campus and every campus. */
export function useCampusScope(): [CampusScope, (scope: CampusScope) => void] {
  const [scope, setScope] = useState<CampusScope>("campus");
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "all") setScope("all");
    } catch {
      /* storage unavailable: stay on "My campus" */
    }
  }, []);
  const update = useCallback((next: CampusScope) => {
    setScope(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  }, []);
  return [scope, update];
}

/** Segmented switch: My campus (same university email domain) or Everywhere. */
export default function CampusSwitch({ value, onChange, className = "" }: { value: CampusScope; onChange: (scope: CampusScope) => void; className?: string }) {
  const options: { id: CampusScope; label: string; icon: string }[] = [
    { id: "campus", label: "My campus", icon: "school" },
    { id: "all", label: "Everywhere", icon: "public" },
  ];
  return (
    <div role="group" aria-label="Show posts from" className={`inline-flex rounded-full border border-[#d8d5e6] bg-white p-0.5 ${className}`}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${active ? "bg-[#141b2b] text-white" : "text-[#464555] hover:bg-[#f1f0f7]"}`}
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden>{option.icon}</span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

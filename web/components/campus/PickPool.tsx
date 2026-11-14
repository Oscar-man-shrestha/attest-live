"use client";

import React, { useEffect, useState } from "react";
import { orderPoolForBranch, type PoolOption } from "@embedra/types";

type Props = {
  pool: PoolOption[];
  branch: string;
  picked: string[];
  onChange: (next: string[]) => void;
  cap: number;
  visibleCount?: number;
  allowCustom?: boolean;
  /** Nearest options by meaning, from the language model. Falls back to the same group. */
  related?: Record<string, string[]>;
  /** Labels ordered by how many students in this branch picked them. They lead; nothing is removed. */
  popular?: string[];
};

export default function PickPool({ pool, branch, picked, onChange, cap, visibleCount = 12, allowCustom = false, related, popular = [] }: Props) {
  const [queue, setQueue] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    const base = orderPoolForBranch(pool, branch);
    const leading = popular.filter((label) => base.includes(label));
    setQueue([...leading, ...base.filter((label) => !leading.includes(label))]);
  }, [pool, branch, popular]);

  const popularSet = new Set(popular.slice(0, visibleCount));

  const groupOf = (label: string) => pool.find((option) => option.label === label)?.group;
  const open = queue.filter((label) => !picked.includes(label));
  const visible = open.slice(0, visibleCount);
  const full = picked.length >= cap;

  const pick = (label: string) => {
    if (full) return;
    const rest = open.filter((item) => item !== label);
    const slot = visibleCount - 1;
    const kept = rest.slice(0, slot);
    const later = rest.slice(slot);
    const nearest = related?.[label]?.filter((item) => later.includes(item)) ?? [];
    const sameGroup = later.filter((item) => !nearest.includes(item) && groupOf(item) === groupOf(label));
    const others = later.filter((item) => !nearest.includes(item) && !sameGroup.includes(item));
    setQueue([...kept, ...nearest, ...sameGroup, ...others]);
    setFresh(nearest[0] ?? sameGroup[0] ?? others[0] ?? null);
    onChange([...picked, label]);
  };

  const unpick = (label: string) => {
    onChange(picked.filter((item) => item !== label));
    if (pool.some((option) => option.label === label)) setQueue((items) => [label, ...items.filter((item) => item !== label)]);
  };

  const showOthers = () => {
    setQueue([...open.slice(visibleCount), ...open.slice(0, visibleCount)]);
    setFresh(null);
  };

  const addCustom = () => {
    const label = custom.trim();
    setCustom("");
    if (!label || full || picked.some((item) => item.toLowerCase() === label.toLowerCase())) return;
    onChange([...picked, label]);
    setQueue((items) => items.filter((item) => item.toLowerCase() !== label.toLowerCase()));
  };

  return (
    <div className="space-y-3">
      {picked.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#777587] mb-2">Your picks · {picked.length} of {cap}</p>
          <div className="flex flex-wrap gap-2">
            {picked.map((label) => (
              <button
                type="button"
                key={label}
                onClick={() => unpick(label)}
                className="px-3 py-1.5 rounded-full text-[12px] border bg-[#4f46e5] text-white border-[#4f46e5]"
                title="Remove"
              >
                {label} ×
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#777587]">
            {full ? "That is the cap" : "Tap to add"}
            {!full && popularSet.size > 0 && <span className="normal-case tracking-normal font-normal"> · <span className="text-[#4f46e5]">●</span> popular with {branch} students</span>}
          </p>
          {open.length > visibleCount && (
            <button type="button" onClick={showOthers} className="text-[12px] text-[#4f46e5]">Show other options</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {visible.map((label) => (
            <button
              type="button"
              key={label}
              disabled={full}
              onClick={() => pick(label)}
              className={`px-3 py-1.5 rounded-full text-[12px] border border-[#c7c4d8] hover:border-[#4f46e5] disabled:opacity-40 ${fresh === label ? "ring-2 ring-[#4f46e5]/40" : ""}`}
            >
              + {label}
              {popularSet.has(label) && <span className="ml-1 text-[10px] text-[#4f46e5]" title={`Popular with ${branch} students`}>●</span>}
            </button>
          ))}
        </div>
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            placeholder="Add your own"
            maxLength={40}
            className="flex-1 rounded-lg border border-[#c7c4d8] px-3 py-2 text-[14px]"
          />
          <button type="button" onClick={addCustom} className="px-3 rounded-lg border border-[#c7c4d8] text-[13px]">Add</button>
        </div>
      )}
    </div>
  );
}

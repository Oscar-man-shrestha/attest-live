/** Usage bar for one plan limit, e.g. "3 of 5 members". */
export default function PlanMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const full = used >= limit;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-[#464555]">{label}</span>
        <span className={`ledger font-semibold ${full ? "text-[#b45309]" : "text-[#141b2b]"}`}>{used} / {limit}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[#eceaf4]" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit}>
        <div className={`h-1.5 rounded-full ${full ? "bg-[#b45309]" : "bg-[#047857]"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

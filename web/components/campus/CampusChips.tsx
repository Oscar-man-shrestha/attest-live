/** Small chips: "Same campus" (viewer shares the poster's email domain) and "Campus only". */
export default function CampusChips({ sameCampus, campusOnly }: { sameCampus?: boolean; campusOnly?: boolean }) {
  if (!sameCampus && !campusOnly) return null;
  return (
    <>
      {sameCampus && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-2 py-0.5 text-[11px] font-semibold text-[#3730a3]">
          <span className="material-symbols-outlined text-[13px]" aria-hidden>school</span>
          Same campus
        </span>
      )}
      {campusOnly && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#e4e2ee] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#464555]">
          <span className="material-symbols-outlined text-[13px]" aria-hidden>lock</span>
          Campus only
        </span>
      )}
    </>
  );
}

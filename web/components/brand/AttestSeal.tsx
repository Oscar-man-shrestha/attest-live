/** Brand mark: a notary-style seal with a tick. Colour comes from `currentColor`. */
export default function AttestSeal({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="24" cy="24" r="21.5" strokeWidth="2" strokeDasharray="1.6 3.6" />
      <circle cx="24" cy="24" r="15.5" strokeWidth="2.2" />
      <path d="M16.8 24.6l5 5 9.6-10.8" strokeWidth="3.2" />
    </svg>
  );
}

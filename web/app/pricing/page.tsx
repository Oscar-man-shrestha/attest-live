import Link from "next/link";
import AttestSeal from "@/components/brand/AttestSeal";
import Stamp from "@/components/brand/Stamp";

export const metadata = { title: "Plans — Attest" };

const PLANS: { name: string; price: string; note: string; tone: string; who: string; points: string[]; cta?: { href: string; label: string } }[] = [
  {
    name: "Students", price: "Free", note: "forever", tone: "border-[#dcd9f5]", who: "Builders and idea owners",
    points: ["Post ideas, problems and gigs", "Join teams and take deals", "Keep 100% of what you're paid: no commission, no bidding fees", "Stamped proof record on your profile"],
    cta: { href: "/login", label: "Sign in" },
  },
  {
    name: "Organisers", price: "Free", note: "during the pilot", tone: "border-[#9bd9bd] bg-[#f4fdf8]", who: "Fest teams, clubs, local businesses",
    points: ["Kits: one need list per event, tracked from open to paid", "Reach verified students on your campus first", "Every payment confirmed by both sides", "A paid plan may come later for large events; pilot kits stay free"],
    cta: { href: "/kits", label: "Start a kit" },
  },
  {
    name: "Campus & employers", price: "Not open yet", note: "", tone: "border-[#e4e2ee]", who: "Colleges, brands, recruiters",
    points: ["Verified proof-of-work search", "Brand briefs to student creators", "Campus-wide workspace", "We'll open this once students and organisers are well served"],
  },
];

export default function PricingPage() {
  return (
    <div className="paper-grid min-h-[calc(100vh-4rem)] px-5 py-10 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-[#4f46e5]">
          <AttestSeal size={30} />
          <span className="font-serif text-[22px] font-bold tracking-tight text-[#141b2b]">Attest</span>
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="serial">Plans · plain and honest</p>
            <h1 className="mt-1 font-serif text-[40px] font-semibold leading-tight tracking-tight text-[#141b2b]">
              Students never pay. <span className="hl-green">Ever.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] text-[#464555]">
              Attest never holds your money and takes no cut of what students earn. If Attest charges anyone in future, it will be the organisations that hire, not the students who build.
            </p>
          </div>
          <Stamp icon="verified" large>0% from builders</Stamp>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <section key={plan.name} className={`ticket ${plan.tone}`}>
              <div className="p-5">
                <p className="serial">{plan.who}</p>
                <h2 className="mt-1 font-serif text-[24px] font-semibold text-[#141b2b]">{plan.name}</h2>
                <p className="mt-2"><span className="ledger text-[28px] font-bold text-[#141b2b]">{plan.price}</span> <span className="text-[13px] text-[#777587]">{plan.note}</span></p>
              </div>
              <div className="ticket-tear" />
              <ul className="p-5 space-y-2 text-[14px] text-[#464555]">
                {plan.points.map((point) => <li key={point}>• {point}</li>)}
              </ul>
              {plan.cta && (
                <div className="px-5 pb-5">
                  <Link href={plan.cta.href} className="inline-flex rounded-xl bg-[#141b2b] px-4 py-2.5 text-[13px] font-semibold text-white">{plan.cta.label}</Link>
                </div>
              )}
            </section>
          ))}
        </div>
        <p className="mt-8 text-[12px] text-[#777587]">Nothing on Attest can be bought today, and there is no checkout. <Link href="/rules" className="font-semibold text-[#141b2b] underline underline-offset-2">Read the house rules</Link>.</p>
      </div>
    </div>
  );
}

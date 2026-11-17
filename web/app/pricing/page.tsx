import Link from "next/link";
import { BILLING_ENABLED, LAUNCH_PLAN, PLANS, formatMoney } from "@embedra/types";
import AttestSeal from "@/components/brand/AttestSeal";
import Stamp from "@/components/brand/Stamp";

export const metadata = { title: "Plans — Attest" };

const pro = PLANS.pro;
const free = PLANS.free;
const campus = PLANS.campus;

type PlanCard = { name: string; price: string; note: string; tone: string; who: string; points: string[]; cta?: { href: string; label: string }; highlight?: boolean; soon?: boolean };

const STUDENT_CARD: PlanCard = {
  name: "Students", price: "Free", note: "forever", tone: "border-[#dcd9f5]", who: "Builders and idea people",
  points: ["Post ideas, problems and gigs", "Join teams and take deals", "Keep 100% of what you're paid: no commission, no bidding fees", "Coffee tips go straight to you", "A stamped trust record on your profile"],
  cta: { href: "/login", label: "Sign in free" },
};

// While billing is off (BILLING_ENABLED in packages/types): everything is free and paid plans say "Coming soon", with no price.
const LAUNCH_CARDS: PlanCard[] = [
  STUDENT_CARD,
  {
    name: "Workspace", price: "Free", note: LAUNCH_PLAN.period, tone: "border-[#047857] bg-[#f4fdf8]", who: "Fests, clubs, local businesses", highlight: true,
    points: [`${LAUNCH_PLAN.members} team members`, `${LAUNCH_PLAN.openKits} open kits`, `${LAUNCH_PLAN.needsPerKit} needs per kit`, "CSV export of every kit", "Every need tracked from open to paid"],
    cta: { href: "/workspaces", label: "Create a workspace" },
  },
  {
    name: "Workspace Pro", price: "Coming soon", note: "", tone: "border-[#e4e2ee]", who: "Bigger teams", soon: true,
    points: ["More members and kits", "“Verified organiser” stamp builders can trust", "Priority help"],
  },
  {
    name: "Campus", price: "Coming soon", note: "", tone: "border-[#e4e2ee]", who: "Large fests, colleges, brands", soon: true,
    points: ["Room for a whole fest committee", "Help setting up your first event"],
  },
];

const LAUNCH_FAQ: [string, string][] = [
  ["Is it really free?", "Yes. Students, builders and organisers all use Attest free right now. There is no card to enter and nothing to cancel."],
  ["Will that change?", "Students will always be free and builders will always keep everything they're paid. Bigger organiser teams may get paid plans later. If that happens we'll tell you well in advance, and nothing you've made goes away."],
  ["Does Attest hold the money for gigs and deals?", "Never. Builders are paid directly by the person who hired them, and both confirm it on Attest."],
];

const PAID_CARDS: PlanCard[] = [
  {
    name: "Students", price: "Free", note: "forever", tone: "border-[#dcd9f5]", who: "Builders and idea people",
    points: ["Post ideas, problems and gigs", "Join teams and take deals", "Keep 100% of what you're paid: no commission, no bidding fees", "Coffee tips go straight to you", "A stamped trust record on your profile"],
    cta: { href: "/login", label: "Sign in free" },
  },
  {
    name: "Workspace Free", price: "₹0", note: "forever", tone: "border-[#e4e2ee]", who: "Small clubs and first events",
    points: [`${free.members} team members`, `${free.openKits} open kits`, `${free.needsPerKit} needs per kit`, "Every need tracked from open to paid"],
    cta: { href: "/workspaces", label: "Create a workspace" },
  },
  {
    name: "Workspace Pro", price: formatMoney(pro.priceMinor, pro.currency) ?? "", note: pro.period, tone: "border-[#047857] bg-[#f4fdf8]", who: "Fests, active clubs, local businesses", highlight: true,
    points: [`${pro.members} team members`, `${pro.openKits} open kits`, `${pro.needsPerKit} needs per kit`, "CSV export of every kit", "“Verified organiser” stamp builders can trust"],
    cta: { href: "/workspaces", label: "Start free, upgrade anytime" },
  },
  {
    name: "Campus", price: "Let's talk", note: campus.period, tone: "border-[#e4e2ee]", who: "Large fests, colleges, brands",
    points: [`Up to ${campus.members} team members`, `${campus.openKits} open kits`, `${campus.needsPerKit} needs per kit`, "Everything in Pro", "Help setting up your first event"],
    cta: { href: "/workspaces", label: "Request from a workspace" },
  },
];

const PAID_FAQ: [string, string][] = [
  ["Do students ever pay?", "No. Students, builders and idea people use Attest free, and builders keep everything they're paid. Only organiser workspaces can choose a paid plan."],
  ["How do I pay for Pro?", "Request Pro from your workspace page. We email you to arrange payment and send an invoice, then switch the plan on. There's no card checkout yet."],
  ["Does Attest hold the money for gigs and deals?", "Never. Builders are paid directly by the person who hired them, and both confirm it on Attest. Plan fees are separate and go to Attest."],
  ["What happens when a plan ends?", "Your workspace goes back to Free. Nothing is deleted; you just can't open new kits or add members beyond the Free limits until you renew."],
];

const PLAN_CARDS = BILLING_ENABLED ? PAID_CARDS : LAUNCH_CARDS;
const FAQ = BILLING_ENABLED ? PAID_FAQ : LAUNCH_FAQ;

export default function PricingPage() {
  return (
    <div className="paper-grid min-h-[calc(100vh-4rem)] px-5 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-[#4f46e5]">
          <AttestSeal size={30} />
          <span className="font-serif text-[22px] font-bold tracking-tight text-[#141b2b]">Attest</span>
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="serial">Plans · plain and honest</p>
            <h1 className="mt-1 font-serif text-[40px] font-semibold leading-tight tracking-tight text-[#141b2b]">
              {BILLING_ENABLED ? <>Students never pay. <span className="hl-green">Organisers can.</span></> : <>Free for everyone. <span className="hl-green">For now, all of it.</span></>}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] text-[#464555]">
              {BILLING_ENABLED
                ? "Attest is free for every student. Fest teams, clubs and businesses run their events from a workspace, free to start, with Pro when they need more room."
                : "Attest is free for every student and every organiser while it's new. Paid plans for bigger teams are coming soon; students will always be free."}
            </p>
          </div>
          <Stamp icon="verified" large>0% from builders</Stamp>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_CARDS.map((plan) => (
            <section key={plan.name} className={`ticket ${plan.tone} ${plan.highlight ? "shadow-[6px_6px_0_0_#047857]" : ""}`}>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="serial">{plan.who}</p>
                  {plan.highlight && <span className="rounded-full bg-[#047857] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{BILLING_ENABLED ? "Popular" : "Free now"}</span>}
                  {plan.soon && <span className="rounded-full border border-dashed border-[#a8a5bd] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#777587]">Soon</span>}
                </div>
                <h2 className="mt-1 font-serif text-[22px] font-semibold text-[#141b2b]">{plan.name}</h2>
                <p className="mt-2"><span className={`ledger font-bold ${plan.soon ? "text-[20px] text-[#777587]" : "text-[28px] text-[#141b2b]"}`}>{plan.price}</span> <span className="text-[13px] text-[#777587]">{plan.note}</span></p>
              </div>
              <div className="ticket-tear" />
              <ul className={`p-5 space-y-2 text-[14px] ${plan.soon ? "text-[#777587]" : "text-[#464555]"}`}>
                {plan.points.map((point) => <li key={point}>• {point}</li>)}
              </ul>
              {plan.cta && (
                <div className="px-5 pb-5">
                  <Link href={plan.cta.href} className={`inline-flex rounded-xl px-4 py-2.5 text-[13px] font-semibold ${plan.highlight ? "bg-[#047857] text-white" : "bg-[#141b2b] text-white"}`}>{plan.cta.label}</Link>
                </div>
              )}
            </section>
          ))}
        </div>

        <section className="mt-12 max-w-3xl">
          <h2 className="font-serif text-[26px] font-semibold text-[#141b2b]">Questions</h2>
          <dl className="mt-4 space-y-4">
            {FAQ.map(([q, a]) => (
              <div key={q} className="ticket p-5">
                <dt className="font-semibold text-[#141b2b]">{q}</dt>
                <dd className="mt-1 text-[14px] text-[#464555]">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p className="mt-8 text-[12px] text-[#777587]">{BILLING_ENABLED ? "Prices in Indian rupees. " : ""}<Link href="/rules" className="font-semibold text-[#141b2b] underline underline-offset-2">House rules</Link> · <Link href="/privacy" className="font-semibold text-[#141b2b] underline underline-offset-2">Privacy</Link></p>
      </div>
    </div>
  );
}

import Link from "next/link";
import AttestSeal from "@/components/brand/AttestSeal";
import Stamp from "@/components/brand/Stamp";

export const metadata = { title: "House rules — Attest" };

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

const RULES: { n: string; title: string; body: string[] }[] = [
  {
    n: "01",
    title: "Real projects only. Never graded coursework.",
    body: [
      "Attest is for real projects, problems and gigs. Don't ask anyone to do work you will hand in for a grade, and don't offer to do it: no assignments, lab records, exams, quizzes, or project reports for marks.",
      "A capstone or final-year project is fine only as open collaboration that your instructor knows about. It can never be a paid job you hand in as your own.",
      "Every post carries this promise. Posts that read like coursework are reviewed by a moderator and hidden if they are.",
    ],
  },
  {
    n: "02",
    title: "Attest never holds your money.",
    body: [
      "Paid work is paid directly between the two of you (UPI, bank transfer, Payoneer, Wise and so on), one milestone at a time, after the work is accepted.",
      "Both of you then confirm the payment on Attest. Only payments both sides confirm count as proof.",
      "Builders pay Attest nothing. Never pay anyone a fee to apply, and never pay before a milestone is accepted.",
      "Because we don't hold money, we can't refund or recover a payment. Keep milestones small.",
    ],
  },
  {
    n: "03",
    title: "Paid work is for people 18 or older.",
    body: ["Both sides of a paid deal confirm they are 18 or older. If you're younger you can still join open-source and credit-only projects."],
  },
  {
    n: "04",
    title: "You sign in with a university email. You choose what others see.",
    body: [
      "A university email is the one requirement, so everyone here is a student. Attest is not affiliated with any university.",
      "Other people see your handle. Your university is hidden unless you turn it on, though people on your own campus can see a “Same campus” badge. Your email is never shown.",
      "Your payment app may show your legal name to the person you pay or who pays you. That happens outside Attest.",
    ],
  },
  {
    n: "05",
    title: "Proof is what someone else confirmed.",
    body: [
      "A task counts when a teammate signs it. A milestone counts when the other side accepts it. A payment counts when both confirm it.",
      "Likes and “I'd use this” are signals, not proof. Reviews stay hidden until both people write theirs or 14 days pass.",
    ],
  },
  {
    n: "06",
    title: "Agree who owns the work before you start.",
    body: [
      "The default in a paid deal: each milestone's work belongs to the requester once that payment is confirmed by both sides, and the builder may show it in their portfolio unless you agree an NDA.",
      "Open-source projects pick a licence when posted. For co-owned projects, write the split down outside Attest too. These defaults are not legal advice.",
      "Visibility settings control who sees your idea. They don't give you exclusive ownership of it.",
    ],
  },
  {
    n: "07",
    title: "Keep it honest and keep it here.",
    body: [
      "No spam, copied work, fake accounts, harassment, or anything illegal. One account per person.",
      "Messages live only inside a team or a deal. There are no open DMs.",
      "A moderator can hide posts. Fraud, payment abuse and coursework cheating can get an account suspended; you can always appeal once from your profile.",
    ],
  },
];

export default function RulesPage() {
  return (
    <div className="paper-grid min-h-[calc(100vh-4rem)] px-5 py-10 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-[#4f46e5]">
          <AttestSeal size={30} />
          <span className="font-serif text-[22px] font-bold tracking-tight text-[#141b2b]">Attest</span>
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="serial">House rules · plain language</p>
            <h1 className="mt-1 font-serif text-[40px] font-semibold leading-tight tracking-tight text-[#141b2b]">
              Seven rules that keep <span className="hl-indigo">proof</span> worth something
            </h1>
          </div>
          <Stamp tone="ink" icon="gavel">Applies to everyone</Stamp>
        </div>

        <ol className="mt-8 space-y-4">
          {RULES.map((rule) => (
            <li key={rule.n} className="ticket">
              <div className="flex gap-4 p-5">
                <span className="ledger text-[15px] font-bold text-[#4f46e5]">{rule.n}</span>
                <div>
                  <h2 className="font-serif text-[20px] font-semibold text-[#141b2b]">{rule.title}</h2>
                  <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-[#464555]">
                    {rule.body.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-[#e4e2ee] bg-white p-5 text-[14px] leading-relaxed text-[#464555]">
          <h2 className="font-serif text-[18px] font-semibold text-[#141b2b]">What Attest is, and isn&apos;t</h2>
          <p className="mt-2">Attest introduces students to each other and records what they agree and confirm. It is not a party to any deal, does not employ anyone, does not handle payments, and cannot guarantee anyone&apos;s work or payment. Agreements are between the two people involved.</p>
          <p className="mt-2">
            Complaints and takedown requests: use Report on the post{SUPPORT_EMAIL ? <>, or write to <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#141b2b] underline">{SUPPORT_EMAIL}</a>. We aim to acknowledge within 24 hours and resolve within 15 days</> : ""}.
          </p>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-[#777587]">
          These rules are a plain-language summary and may change as Attest grows. <Link href="/pricing" className="font-semibold text-[#141b2b] underline underline-offset-2">Plans</Link>: students never pay.
        </p>
        <Link href="/login" className="mt-5 inline-flex rounded-xl bg-[#141b2b] px-5 py-3 text-[14px] font-semibold text-white">Sign in with your university email</Link>
      </article>
    </div>
  );
}

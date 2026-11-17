import Link from "next/link";
import AttestSeal from "@/components/brand/AttestSeal";

export const metadata = { title: "Privacy — Attest" };

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "What we keep",
    body: [
      "Your email address, to sign you in. It is never shown publicly. The contact email on an idea or problem (your sign-in email unless you change it) is shared only with teammates you accept.",
      "Your profile: name, handle, branch, semester, skills, interests, links, and anything else you choose to add. CGPA is optional and only shown to you and to owners of ideas you ask to join.",
      "If you sign in with a university email, its domain, so we can show the Verified student stamp and your campus. Your university name stays hidden unless you turn it on.",
      "What you post and do here: ideas, problems, gigs, kits, comments, likes, saves, team and deal messages, tasks, milestones, reviews and reports.",
      "Payment records you enter: the method (for example UPI) and a receipt ID. Never an account, card or UPI number.",
      "If you run a workspace and ask for a paid plan: the plan, the agreed amount and dates. Admins see your handle and email so they can arrange payment and an invoice. Card or bank details are never entered on Attest.",
      "What you open and how long you read, so the feed can suggest better ideas. This stays inside Attest.",
    ],
  },
  {
    title: "What we don't keep",
    body: [
      "Résumés and idea briefs you upload are read once to fill in the form, then deleted.",
      "No passwords: sign-in uses Google, Microsoft or a one-time email code.",
      "No ads, no advertising trackers, and no analytics companies.",
      "We never sell or rent your information.",
    ],
  },
  {
    title: "Who else handles it",
    body: [
      "Supabase stores the database and uploaded images (servers in Mumbai, India).",
      "Resend sends sign-in codes and notification emails.",
      "Google or Microsoft confirm who you are when you use those sign-in buttons. We receive your name and email from them, nothing else.",
      "GitHub's public API, only if you add your GitHub profile, to show public repository stats.",
      "Google Fonts serves the fonts and icons, so your browser contacts Google when pages load.",
      "Matching and the coursework check run on Attest's own servers. Your text is not sent to any outside AI company.",
    ],
  },
  {
    title: "Who can see what",
    body: [
      "Other people see your handle, your public profile, and what you post. Hidden-name posts don't show your name or link to your profile. Your “Buy me a coffee” link, if you add one, opens your own tipping page, which may show your name.",
      "Team threads are visible only to that team. Deal threads only to the two people in the deal.",
      "Admins can see reported posts, coursework flags and suspension appeals to keep the site safe.",
      "Campus-only posts are never shown to people from another university.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "Edit your profile at any time, hide your name on a post, or keep your university hidden.",
      "To get a copy of your data or have your account deleted, write to us. We'll reply within 15 days. Things other people confirmed (signed tasks, accepted milestones, reviews) may stay on their records without your name.",
      "Attest is not for anyone under 18 to do paid work. If you're under 18, use only the unpaid parts.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="paper-grid min-h-[calc(100vh-4rem)] px-5 py-10 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 text-[#4f46e5]">
          <AttestSeal size={30} />
          <span className="font-serif text-[22px] font-bold tracking-tight text-[#141b2b]">Attest</span>
        </Link>
        <p className="serial mt-6">Privacy · plain language</p>
        <h1 className="mt-1 font-serif text-[40px] font-semibold leading-tight tracking-tight text-[#141b2b]">
          What Attest keeps, and <span className="hl-indigo">why</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#464555]">
          Attest keeps only what it needs to sign you in, show your work, and keep the site safe.
        </p>

        <div className="mt-8 space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="ticket p-5">
              <h2 className="font-serif text-[20px] font-semibold text-[#141b2b]">{section.title}</h2>
              <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-[#464555]">
                {section.body.map((line) => <li key={line}>• {line}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-[#e4e2ee] bg-white p-5 text-[14px] text-[#464555]">
          <h2 className="font-serif text-[18px] font-semibold text-[#141b2b]">Contact</h2>
          <p className="mt-1">
            {SUPPORT_EMAIL
              ? <>Questions, data requests or deletion: <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#141b2b] underline">{SUPPORT_EMAIL}</a>.</>
              : <>Questions, data requests or deletion: use Report on any post, or reach the team that invited you. A contact email will appear here soon.</>}
          </p>
        </div>

        <p className="mt-6 text-[12px] leading-relaxed text-[#777587]">
          This page may change as Attest grows; we&apos;ll date each change. See also the <Link href="/rules" className="font-semibold text-[#141b2b] underline underline-offset-2">house rules</Link>.
        </p>
      </article>
    </div>
  );
}

# RULES.md — Non-negotiables

Agents and humans: break these only with an explicit user decision recorded in MEMORY.md.

## Product
1. Anyone can sign in with a verified email (Google, email code, or Amrita Outlook). A university email is optional: it earns the "Verified student" stamp and unlocks campus features. Attest is not a university product and is not affiliated with any university. (Changed 2026-11-15, twice.)
2. No open DMs. Messages exist only inside an engagement (archived when it closes) or inside a team thread (owner and active team members only). No user-facing idea takedown. No active push notifications (transactional email is fine).
3. Platform-level suspension is admin-only, needs a written reason, and always allows an appeal. Community bans (if ever) stay one-community scoped.
4. Owner cannot rate their own idea (legacy ratings). Skills are signed only via receipts.
5. Contribution / receipt defaults stay pending until owner signs.
6. University from verified email is not editable, and is hidden from other users unless the user turns on `show_institution`. Exception: people verified on the same email domain can see a "Same campus" badge on each other's posts.
7. CGPA is never on the public profile; only self + idea owner on offers.
8. Resume and idea-brief files are parsed then deleted. Do not store binaries long-term.
9. Likes are social; signatures are proof. Do not treat likes as verified skill.
10. Forks are allowed on viewable ideas; fork copies only the public slice for that idea’s visibility and never the private approach; fork does not alter the source.
11. Idea visibility is owner-chosen (`minimal` \| `standard` \| `open`). List/detail APIs must not leak gated fields to non-members.
12. Ideas and Problems are separate boards (indigo vs amber). Do not merge their CTAs or card badges.

## Money and integrity (added 2026-11-15)
13. Attest never holds, pools or routes users' money. Phase 1 payment happens off-platform; Attest only records it.
14. A paid milestone counts as proof only when both payer and payee confirm the payment.
15. Paid deal types (`paid_fixed`, `sponsor_stipend`) need both parties to have confirmed they are 18 or older. Under-18s may join unpaid deals only.
16. Builders pay 0% to Attest. Never add a fee on the student side. Only workspaces (organisers) can be charged, for their own plan.
17a. Campus-only posts (`campus_only`) are never shown to another email domain, in any list or detail endpoint.
17. No graded coursework, exams or assignments for either party. Every post and engagement carries the not-graded-work attestation. Capstones only as disclosed collaboration. Flags go to human review; never auto-ban.
18. Never store bank account, card or UPI numbers. Payment references are free-text receipts IDs only. A profile tip link must be an https link to an allowlisted tipping service.
19. Reviews stay hidden until both sides submit or 14 days pass, and are shown as distributions, not averages.

## Engineering (also in AGENTS.md)
1. No paid LLM APIs. NLP is self-hosted, pretrained, CPU-only, no fine-tuning.
2. No new infra (Kafka, GraphQL, new DB, payment processor…) without asking.
3. Express stays separate from Next.js — no moving API into App Router server actions.
4. Shared Zod lives in `packages/types`. Do not duplicate schemas in web and api.
5. Schema changes update `DATA.md` first, then migration, then code.
6. List endpoints are cursor-paginated — never unbounded.
7. Slow work goes through queues/workers, not inline in request handlers.
8. Secrets stay in `.env` — never commit, never print.

## Docs
1. After a sticky decision, update MEMORY.md the same day.
2. New endpoints get Zod + an API.md row.
3. TASKS.md is the backlog; do not invent Phase 5 features mid-sprint without checking it.

# MEMORY.md — What Attest is right now

Last updated: 2026-11-15. Read before changing product behaviour.

## Marketplace Phase 1 decision (2026-11-15, decided by the founder)
Source plan: `reports/Student project marketplace plan.md` in the old `attest` repo. The founder chose "adopt all" on these rule changes:
1. **Sign-up opens to any verified academic email worldwide** (`.edu`, `.edu.xx`, `.ac.xx`, plus an allowlist in `packages/types/campus.ts`). Verified by OTP. Each verification is stored in `academic_verifications` with a one-year expiry. Attest is not affiliated with any university.
2. **University is hidden by default.** Public cards show "Verified student"; the institution shows only when the user turns on `show_institution`. It is still read-only from the email.
3. **Handles.** `users.username` is the public handle. New accounts get a random handle (no roll numbers); users can rename it once it's unique. One handle per verified account.
4. **Deal types are mandatory** on ideas: `paid_fixed | sponsor_stipend | open_source | co_owned | credit_only`. Paid types carry currency + amount. The compensation sentence stays as the human explanation.
5. **Under-18s: unpaid only.** Paid deal types need both requester and builder to have confirmed they are 18 or older.
6. **Not-graded-work attestation** is required when posting an idea, a problem, or an engagement. Graded coursework is banned. Capstones only as disclosed collaboration. A keyword + MiniLM similarity check flags posts for admin review; it never auto-bans.
7. **Engagements + milestones** sit on top of teams. Payment is off-platform in Phase 1 (UPI, bank, Payoneer, Wise, PayPal…). Attest never holds money. A milestone counts as paid proof only when the payer and the payee both confirm the payment. 7-day acceptance window, then auto-accept.
8. **Messaging:** still no open DMs. Threads exist only inside an engagement, archived on close. Messages that contain payment handles or phone numbers get a warning flag.
9. **Platform-level suspension with appeal** for fraud, payment abuse and academic cheating (admin only). Community bans stay one-community scoped.
10. **Sprint is optional.** Sprints roll over automatically as 14-day build seasons, so the board never closes. Team cap raised from 4 to 6. A builder can hold at most 2 active paid engagements.
11. **Reviews** are structured (on time, communication, quality, would work again), hidden until both sides submit or 14 days pass, and shown as distributions, never averages.
12. Still no push notifications; transactional email for deadlines and payment confirmations is allowed. Still no organisations-as-entities until Phase 3.
13. Brand stays **Attest**. Internal code names (`embedra`) are not renamed.

## Campus pilot decision (2026-10-18)
- First launch stays student-only. Faculty or staff needs can be reported by eligible students with consent for named attribution.
- Accepting a proposal on a Problem credits the reporter as its source but does not add them to the build team. A reporter who wants to contribute sends a normal join offer to the builder-owned Idea.
- Problem proposals preserve the builder's Idea visibility choice. Hidden-name posts must not reveal the reporter's or owner's user ID to unrelated students.

## Product name
**Attest** (repo folder `embedra2-live`, GitHub `attest-live`). Proof-backed student build network: started as a campus sprint for Amrita Bengaluru; from 2026-11-15 open to any verified academic email worldwide.

## What works live today
| Area | Status |
| --- | --- |
| Outlook + OTP login | Working; OTP rate-limited; login branded |
| Profile wizard + edit tabs | Working; cover/avatar upload; follow; signed trail + streak |
| Resume OCR/NLP + project review UI | Working; junk titles filtered |
| Ideas board (was Feed) / Latest / Saved | Wider Medium-style cards; Ask to join + Start my version; hero thumbs; Saved includes problems |
| Idea visibility | `minimal` \| `standard` \| `open`; teaser DTO gates brief for non-members |
| Idea brief OCR autofill | `idea_brief` uploads; bytes deleted after parse; 3/hour |
| Idea images | 1 hero + 2 figures via campus API; ≤5 MB |
| Rich offers | Skills / phases / plan + full problem proposal fields on decide; applicant snapshot |
| Like / comment / share / save / fork | Working; fork copies public slice only |
| People / circles / invite | Working; Follow on People cards |
| Idea detail + mobile bottom nav | Working; Ideas indigo / Problems amber |
| Workspace: next task, stuck, day-7 | Working |
| Day-7 nudge worker | Polls every 5m; notices + mail |
| Inbox | Smart triage: fit-ranked offers (MiniLM), signatures, invites, day-7; nav badge; mark notices read |
| Invites | `GET/POST /campus/invites/:id` + branded invite token join |
| Problems, offers, proof, help, reports | Working; Problems board + create form amber accents; rich problem proposals |
| Landing | Brand-first Attest hero + Ideas / Problems columns |
| Deploy | `DEPLOY.md` + `.env.example` files; CORS via `WEB_ORIGIN`; enriched `/api/v1/health` |

## Stack
- `web/` :3001 · `api/` :5001 · `nlp/` :8001 · Supabase Postgres+pgvector

## Hard decisions
1. Credit = signed receipt; likes are social.
2. No open DMs / takedown / push notifications. Engagement-scoped threads and admin suspension with appeal are allowed (2026-11-15).
3. CGPA only self + offer owners.
4. University from email — read-only.
5. Resume and idea-brief bytes deleted after parse.
6. Anyone can fork the **public slice** for that visibility; private approach is never forked; forks skip two-idea cap.
7. No paid LLM drafts (copy says drafting is off for the sprint).
8. Ideas = builds seeking teammates (indigo `#4f46e5`). Problems = campus pains needing a builder (amber `#b45309`).
9. Progressive disclosure: teaser → structured apply → unlock full brief / approach after accept (unless owner picked Open).

## Before real students
1. **Rotate Microsoft client secret** (Entra) — only outstanding human step
2. Re-run `--wipe-probes` if probes return
3. Follow `DEPLOY.md` for env + smoke test (`WEB_ORIGIN`, strong `JWT_SECRET`)
4. Confirm `GET /api/v1/health` returns `nlp: "ok"` in the deploy environment

## Seed
```bash
cd packages/db && npx ts-node --transpile-only seed-campus.ts
cd packages/db && npx ts-node --transpile-only seed-campus.ts --wipe-probes
```

## Campus layer, gigs and visual identity decision (2026-11-15, founder: "implement if good")
1. **Campus = same verified email domain.** `users.email_domain` is stored at sign-in. No university partnership is involved.
2. **My campus / Everywhere switch** on Ideas, Problems, People, the feed and Gigs.
3. **Campus-only posts.** Ideas and gigs can be limited to the poster's campus (`campus_only`). Other campuses never see them in lists, detail, feed, similar, profile posts or saved.
4. **"Same campus" badge.** People on the same email domain can see that a post comes from their campus, even when the name is hidden. The university name is still hidden from everyone else unless `show_institution` is on (RULES 6 amended).
5. **Gigs board** (quick freelancing, emerald accent `#047857`). Two kinds: `request` ("I need this done") and `offer` ("I can do this", a service listing). Shown by handle only. A response accepted by the gig author becomes an active one-milestone deal straight away (both sides already opted in). All Phase 1 money rules apply: Attest never holds money, paid gigs need both 18+, the not-graded-work attestation is required, builders pay 0%. A user can have at most 5 open gigs.
6. **Engagements may belong to a gig instead of an idea** (`engagements.idea_id` nullable, `gig_id` added).
7. **Visual identity: "lab notebook + proof stamps".** Graph-paper wash, ink-stamp badges for verified states, ticket/receipt cards for money, monospace ledger numbers. Indigo Ideas / amber Problems stay (RULES 12); emerald is money. DESIGN.md updated; the earlier "keep it quiet / no theme" lines are relaxed for stamps and one stamp animation, still no confetti.

## Demand button and team thread decision (2026-11-15, founder said "build them")
1. **"I'd use this"** on ideas: a demand signal, separate from likes. Stored in `reactions` with `target_type = 'want'`. Cards show the total and how many are on the viewer's campus. The owner can't mark their own idea. It is social signal, not proof (RULES 9 still holds).
2. **Team thread**: one thread per idea, readable and writable only by the owner and active team members. Stored in the existing `groups` / `group_messages` tables; the legacy group chat page and Socket.IO stay unlinked. No open DMs (RULES 2 amended). People who leave or are removed lose access. New-message notices are in-app only, at most one per person per idea every 6 hours, no email.

## Google sign-in decision (2026-11-15, founder asked for it)
1. **Sign in with Google** is a third way in, next to the email code and Amrita Outlook. Many universities run their student mail on Google Workspace, so this lets those students in without waiting for an email code.
2. **The academic-email rule still applies** (RULES 1). A Google account is accepted only when Google says its email is verified and the address is a university domain. A personal `@gmail.com` account is refused with a message that explains why. To open Attest to any Google account later, change the check in `api/src/services/googleAuth.ts` and record that decision here.
3. Needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `api/.env` (Google Cloud Console → OAuth client, type "Web application"). The redirect URI is `<web origin>/login/google/callback`. Until those are set, the button does not show.
4. The sign-in page only shows methods that are actually configured (`GET /auth/campus/methods`).
5. `academic_verifications.method` may now be `google`.

## SaaS direction and Kits decision (2026-11-15, founder: "go for SaaS, make it unbeatable, don't ask")
Research (two reports + targeted searches) says student marketplaces fail for lack of buyers, and the platforms that last charge the demand side (Unstop: employers on subscriptions; students free).
1. **Attest is a SaaS-enabled marketplace.** Students are free forever (RULES 16). The product organisers come for is a free single-player tool; the marketplace is what they stay for.
2. **Kits** are that tool: a need list for a fest, club, event or local business. Each need is a request gig linked to the kit, so builders see it on the Gigs board and the organiser tracks every need from open → hired → delivered → paid on one page. A kit can hold 20 needs (the 5-open-gig cap does not apply to kit needs).
3. **Pricing is not switched on.** `/pricing` shows the plan shape honestly: Students free forever; Organiser workspace free during the pilot; Campus and Employer plans "talk to us". No payment keys, no checkout, no commission, until a lawyer and a CA sign off and a registered entity exists.
4. **Campus first.** New visitors default to "My campus" on every board. Gig categories now include offline work (photography, handmade, events, merch) and AI-era work (video, automation).
5. Attest is an introducer and record-keeper, not a party to any deal. `/rules` says so and shows a contact address when `NEXT_PUBLIC_SUPPORT_EMAIL` is set.
6. No third-party accounts or API keys were created for this. Nothing here needs one.

## Open sign-in, thank-you tips and help history decision (2026-11-15, founder)
1. **Anyone can sign in** with any Google account or any email. A university email is no longer required, and Attest does not tie itself to colleges (RULES 1 changed). Reason: lower friction, and no dependence on any college.
2. **University email is now an optional trust signal.** Signing in with one earns the "Verified student" stamp and unlocks the campus features (My campus switch, campus-only posts, Same campus badge). People without one never see or use campus features, and are never grouped by their mail provider.
3. **Thanks, not buying and selling.** The product leads with help and thank-you tips ("buy them a coffee"). A person may add one tip link from an allowlisted service to their profile; Attest shows a button and never touches the money. Fixed-price deals and gigs still exist as an option but are no longer the headline.
4. **Help history.** Profiles show a trust record (people helped, milestones accepted, tasks signed by teammates, deals completed) and a dated history of each piece of help, built only from things someone else confirmed.
5. Pages use the full width on large screens.

## Setup done by the agent (2026-11-17, founder said "do everything yourself")
- Google Cloud project `attest-515009` with OAuth client "Attest web" (localhost:3001 redirect). Keys live only in `api/.env`. App is in Testing mode until there is a public domain with Branding filled in.
- `pixel_97135` is admin. Contact email is the founder's Gmail, set in `web/.env.local`.
- Seed/test accounts kept on the founder's choice.

## SaaS: workspaces, plans and manual billing (2026-11-17, founder: "I wanna make it saas")
1. **Who pays:** organisers (fest teams, clubs, local businesses) pay for a **workspace**. Students never pay and builders keep 0% fees (RULES 16 unchanged).
2. **Workspaces are organisations.** AGENTS rule 9 ("no organizations-as-entities") is lifted for workspaces only. A workspace has an owner and members (the core team); every member can run the workspace's Kits and sees their totals. Each need's responses and deal stay with the person who added that need.
3. **Plans** (limits in `packages/types/campus.ts` → `PLANS`): Free (3 members, 5 open kits, 20 needs per kit), Pro (10 members, 25 kits, 50 needs, CSV export, "Verified organiser" badge), Campus (50 members, 100 kits, 100 needs, by arrangement). Prices are placeholders the founder can edit: Pro ₹799/month, Campus by quote.
4. **Billing is manual for now.** A workspace owner requests an upgrade; an admin activates it after arranging payment and an invoice outside Attest. There is no card checkout and no payment keys, because a payment gateway needs the founder's own KYC. Attest charging for its own service is fine; it still never holds users' money (RULES 13).
5. When the founder has a gateway account (Razorpay Subscriptions), replace the manual activation with a webhook; the `subscriptions` table already has the fields.

## Known limits (2026-11-15)
- The MiniLM coursework check is weak (homework 0.40 vs a real study-tool idea 0.42). The keyword check is the real guard; the model flags only scores ≥ 0.5. Revisit with a better zero-shot model if flags miss things.
- Microsoft (Outlook) sign-in still works only for the Amrita tenant. Everyone else signs in with the email code.
- Legacy `/auth/signup` and `/auth/login` return 410 so nobody skips academic verification.

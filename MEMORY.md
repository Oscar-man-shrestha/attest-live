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

## Known limits (2026-11-15)
- The MiniLM coursework check is weak (homework 0.40 vs a real study-tool idea 0.42). The keyword check is the real guard; the model flags only scores ≥ 0.5. Revisit with a better zero-shot model if flags miss things.
- Microsoft (Outlook) sign-in still works only for the Amrita tenant. Everyone else signs in with the email code.
- Legacy `/auth/signup` and `/auth/login` return 410 so nobody skips academic verification.

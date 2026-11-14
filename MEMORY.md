# MEMORY.md — What Attest is right now

Last updated: 2026-10-18. Read before changing product behaviour.

## Campus pilot decision (2026-10-18)
- First launch stays student-only. Faculty or staff needs can be reported by eligible students with consent for named attribution.
- Accepting a proposal on a Problem credits the reporter as its source but does not add them to the build team. A reporter who wants to contribute sends a normal join offer to the builder-owned Idea.
- Problem proposals preserve the builder's Idea visibility choice. Hidden-name posts must not reveal the reporter's or owner's user ID to unrelated students.

## Product name
**Attest** (repo folder `embedra`). Campus sprint for Amrita Bengaluru (`@bl.students.amrita.edu`).

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
2. No DMs / takedown / platform ban / push notifications.
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

# DEPLOY.md — Ship Attest to campus

Checklist before inviting real `@bl.students.amrita.edu` students. Complete top to bottom.

## 1. Secrets & Entra (do first)
- [ ] **Rotate Microsoft client secret** in Entra (old value was pasted in chat). Update `api/.env` `MICROSOFT_CLIENT_SECRET`.
- [ ] Confirm redirect URI matches production web origin + `/login/callback`.
- [ ] Set strong `JWT_SECRET` (not the repo default).
- [ ] Set `RESEND_API_KEY` / from-address for OTP mail.
- [ ] Confirm `DATABASE_URL` points at Supabase `attest` (or prod project).
- [ ] Set `NEXT_PUBLIC_API_URL` on web to the public API base (`https://…/api/v1`).
- [ ] Set `WEB_ORIGIN` on API to the public web origin (comma-separated if needed). Required in production.
- [ ] Set `NLP_URL` on API to the NLP service (internal URL ok).
- [ ] Disable or leave unset any `GEMINI_API_KEY` / `GROK_API_KEY` — drafts stay off by design.
- [ ] Production: leave `ATTEST_TEST_LOGIN_*` unset.
- [ ] Copy `api/.env.example`, `web/.env.example`, `packages/db/.env.example` as starting points.

## 2. Data hygiene
```bash
cd packages/db
npx ts-node --transpile-only seed-campus.ts --wipe-probes   # remove probe_* only
# optional demo cohort:
npx ts-node --transpile-only seed-campus.ts
```
Restart API after seed so embedding workers fill vectors.

## 3. Services (three processes)
| Service | Dir | Port | Health |
| --- | --- | --- | --- |
| Web | `web/` | 3001 (or 443 behind proxy) | `/` loads Attest landing |
| API | `api/` | 5001 | `GET /api/v1/health` → `{ status, nlp, workers }` |
| NLP | `nlp/` | 8001 | `GET /health` or `/docs` |

Local:
```bash
cd api && npm run dev
cd web && npm run dev          # already pins -p 3001
cd nlp && .venv/bin/uvicorn main:app --port 8001
```

## 4. Smoke test (student POV)
1. Logged-out `/` shows Attest hero + Outlook CTA.
2. Sign in with Outlook or OTP → profile wizard if incomplete.
3. Complete profile → `/ideas` For you + Latest.
4. Like / comment / save / fork on a card.
5. `/saved` lists bookmarks.
6. `/people` shows classmates; invite works if you have an open idea.
7. Offer → accept → workspace → submit → sign → `/proof`.
8. Report spam as student; resolve only as admin.
9. With two student accounts, propose an Idea from a Problem and accept it. The proposer owns the new Idea; the reporter is credited but cannot open the workspace until their own join offer is accepted.
10. Check a hidden-name Problem as an unrelated student: `authorId` is `null`. Check a hidden-name Idea as an unrelated student: `ownerId` is `null`.
11. Check Minimal, Standard and Open Ideas as an unrelated student, then as a teammate. Private approach and contact email stay gated; a Minimal Idea exposes only its teaser and roles before acceptance.

## 5. UX gates (already in product)
- Empty states on inbox, problems, proof, people, reports, feed, saved
- OTP rate limit (1/min, 5/hr) and offer create (8/hr)
- Fork on cards with count
- Sticky engagement on idea detail
- Help happy-path walkthrough
- Reports nav only for admins

## 6. Hosting notes
- Keep Express separate from Next (do not fold into App Router).
- NLP CPU-only; give it enough disk for MiniLM + OCR models.
- Redis optional; campus workers poll without it.
- Put web and api behind HTTPS; set `WEB_ORIGIN` to the exact browser origin (no trailing slash). Local default is `http://localhost:3001`.
- Health: load balancers can probe `GET /api/v1/health` (always HTTP 200; body `status` may be `degraded` when NLP is down).

## 7. After go-live
- Watch Resend bounce/spam rates for OTP.
- Watch NLP disk and API 429s.
- Update `MEMORY.md` when a sticky decision changes.

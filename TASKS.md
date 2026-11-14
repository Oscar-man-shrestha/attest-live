# TASKS.md — Prioritized backlog

Order is intentional. Check MEMORY.md for current truth. Ship checklist: `DEPLOY.md`.

## P0 — Real students can arrive without embarrassment
- [x] **Public landing `/`** — explain 14-day sprint, proof, CTA to Outlook
- [x] **Hide or wire dead chrome** — search Enter → Latest; inbox icon; mobile bottom nav
- [x] **Seed script with realistic names** — `packages/db/seed-campus.ts` (`seed_*`); wipe with `--wipe`
- [x] **Wipe probe accounts** — `--wipe-probes` keeps `seed_*`
- [ ] **Rotate Microsoft client secret** — **user action in Entra** (see `DEPLOY.md`)
- [x] **Empty states** on inbox, problems, proof, people, reports, feed, saved
- [x] **Rate limits** on auth request-code (1/min, 5/hr) and offer create (8/hr)

## P1 — Feed & discovery feel “alive”
- [x] Idea detail: Medium-like reading width, sticky engagement, “More like this”
- [x] Comments on card via PostActions; fork separated for clarity
- [x] Fork button + count on open ideas
- [x] Latest filters + For you “Show more” + Suspense
- [x] Saved ideas — `/saved` + `GET /campus/saves`

## P2 — Profile & trust
- [x] Completed profiles: section-tab edit mode + view public profile
- [x] Clean resume-extracted junk projects — NLP filter + keep/discard review UI
- [x] Proof page empty-state CTA from profile
- [x] People invite UX with multi-idea picker
- [x] **Ideas / Problems trust & UX** — visibility + teaser DTO; OPEN/FULL seats; fork public-slice only; Ideas vs Problems IA (indigo/amber); rich offers; idea_brief OCR autofill + hero images; LinkedIn-light profile (cover/avatar/follow/streak)
- [x] **Smart inbox** — fit-ranked offers (MiniLM), action triage, outgoing asks, signatures to sign, invites, notice read state, nav badge
- [x] **Cross-route polish** — People Follow; Saved + Ideas seat/visibility/blurb; Problems amber create + skills/phases proposals; invite token Attest UI; offers working-on; docs for invites
- [x] **Discovery polish** — hero thumbs on Ideas/Saved/For you; Saved problems; full offer proposal fields; Avatar photos; mobile Inbox badge; touch-friendly Not interested

## P3 — Sprint depth (Anvil path)
- [x] Day-7 check-in nudges — background worker + inbox banner + workspace alert (in-app + mail, no push)
- [x] Workspace clarity — next task, who is stuck, roster, check-in prominence
- [x] Happy path in Help
- [x] Reports queue — admin-only nav

## P4 — Platform / legacy Embedra (defer)
- Communities, tenure ratings, contribution log polish, BullMQ+Redis when traffic needs it
- Image captioning / more NLP endpoints from PHASES.md

## Next after deploy
1. **Rotate Microsoft Entra Secret (User action)**
   - Generate client secret in Azure Portal App Registration; update `MICROSOFT_CLIENT_SECRET` in production `.env`.
2. **First-cohort Day-7 Monitoring**
   - Verify `day7Queue` cron execution in production logs (`npm run worker` or inline queue runner).
   - Check Resend delivery logs for Day-7 reminder emails (`You are invited`, Day-7 check-in alerts).
3. **NLP CPU & Memory Benchmarking**
   - Monitor FastAPI Uvicorn memory when zero-shot document embeddings / resume extraction run concurrently.
   - Adjust worker count or thread pool if students bulk-upload PDFs on day 1.
4. **Targeted Campus Rollout**
   - Seed initial Amrita student cohort or test group (e.g. `npm run seed:campus`).
   - Monitor reports queue at `/reports` for flagged spam or duplicate projects.
5. **Phase 4 Scaling (Post-Sprint)**
   - Transition in-memory polling / DB-backed queues to Redis BullMQ when concurrent active users exceed single-node capacity.
   - Community-scoped feeds if expanding to additional departments or campuses beyond Bengaluru.

## Done recently
- Ideas board v2: shared IdeaCard (feed + saved), Ask to join / Start my version, owner tools strip, Post idea form sections + image previews, EmptyState wash, sidebar Post idea
- Discovery polish: hero images on list/feed/saved; Saved problems; offer proposal full fields; Avatar `src`; MobileNav inbox badge; always-visible Not interested; post-send apply/propose states
- Route polish wave: People Follow, Saved IDEA·OPEN/FULL + gated blurbs, Ideas visibility/seats, Problems create amber + rich proposals, invite token Attest branding, offers working-on snapshot, legacy idea edit → redirect
- `GET/POST /campus/invites/:id` documented in API.md
- Workspace task assignee picker for author (`PATCH /campus/tasks/:id/assignee`)
- Reports queue admin usability (enriched with target titles, non-admin graceful state)
- Saved ideas counter & skeleton loading state
- Social + fork + saved + mobile nav (inbox on mobile bar)
- Day-7 worker (`api/src/queues/day7Queue.ts`)
- Resume project quality gate & ProofStep false-positive fixes
- Deploy hardening: `WEB_ORIGIN` CORS, `/health` and `/api/v1/health` (+ NLP probe), `.env.example` for api/web/db/nlp
- Reports queue UX (open target, restore / leave hidden)
- Login branded with Attest; drafting copy no longer mentions Gemini keys
- Legacy idea page removed — campus `SprintIdeaView` only
- OAuth callback allowed through AppShell; proof uses `useSearchParams`
- Idea form length counters + API validation details; problem report feedback
- Health always 200 (degraded in body); web `start` respects `$PORT`

## How to pick work
1. Real student bounce in 60s → P0 (only Entra secret left — human)
2. Stay but don’t return → polish P1/P2 (done for sprint)
3. Teams form but don’t ship → P3 (done for sprint)
4. Platform scale / communities → P4 only after campus run

# Architecture.md — Attest

## Services

```
Browser (Next.js :3001)
        │  JWT
        ▼
Express API (:5001) ──► Postgres + pgvector (Supabase)
        │                 │
        │                 └─ RLS on; app role BYPASSRLS for API
        │
        ├── background workers (poll, no Redis required yet)
        │     embeddingQueue  → NLP /embed
        │     documentQueue   → NLP /parse-document + GitHub API
        │
        └── Socket.IO (in-memory if no REDIS_URL)

NLP FastAPI (:8001)
  /embed              MiniLM 384-d
  /parse-document     PDF text → RapidOCR fallback → resume/cert extract
```

Express never loads ML. NLP never talks to the DB. Web never talks to NLP.

## Auth
1. Microsoft Entra for `@bl.students.amrita.edu` (preferred)
2. Campus email OTP (Resend when configured)
3. Local-only test login via `ATTEST_TEST_LOGIN_*` when `NODE_ENV !== production`

JWT carries `userId`. Campus routes use `authenticateToken`.

## Data domains (see DATA.md)
- **Identity:** `users` (+ rich profile columns, `profile_embedding`)
- **Sprint:** ideas, problems, offers, tryouts, team_members, tasks, check_ins, proof_pages, sprint_invites, notices
- **Social:** `reactions`, `idea_comments` (+ soft delete), `interactions` (view/dwell/not_interested/share), `saves`
- **Documents:** `documents` (queued → parsed/failed; `content` cleared)

## Ranking (For you)
Described in `api/src/services/recommender.ts`:
content + skill + peers + cohort/circle + fresh + popular + branch − fatigue, then MMR + explore slots.

People ranking / circles: `api/src/services/peers.ts`.

## Async rule
Any NLP call, OCR, email, or GitHub check is nudged into a worker — never awaited inside a request handler for the heavy path. Uploads return `202` and clients poll.

## Environments
| Var (examples) | Where |
| --- | --- |
| `DATABASE_URL` | api, packages/db |
| `JWT_SECRET` | api |
| `NLP_URL` | api (default `http://localhost:8001`) |
| `NEXT_PUBLIC_API_URL` | web → `http://localhost:5001/api/v1` |
| Microsoft + Resend keys | api only |

## Real-user readiness notes
- Migrations live under `packages/db/migrations/` and are applied to Supabase
- API compiles against `packages/db/*.js` — re-run `tsc` in packages/db after schema edits
- Free-tier disk: keep NLP deps lean (no GLiNER)
- Rate limits: document uploads (5/hour), comments (20/10min) — extend similarly for signup abuse before public invite

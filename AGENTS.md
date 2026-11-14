# AGENTS.md

## Purpose
How any AI coding agent (or human) should behave in this repo. Read before writing code.

## Start here
1. `MEMORY.md` — what is live right now  
2. `PRD.md` — product jobs and non-goals  
3. `RULES.md` — non-negotiables  
4. `Architecture.md` — services and data flow  
5. `DESIGN.md` — UI principles  
6. `TASKS.md` — prioritized backlog
7. `DEPLOY.md` — ship checklist before real students
8. `DATA.md` / `API.md` — schema and HTTP contract

## Project Summary
**Attest** (folder still `embedra`) is a campus sprint for Amrita Bengaluru students: ideas, problems, teammates, signed proof. NLP powers discovery and document parsing via self-hosted models.

## Tech Stack (do not deviate without explicit instruction)
- Frontend: Next.js + TailwindCSS (`web/` port **3001**)
- Backend: Node + Express — separate from Next.js (`api/` port **5001**)
- DB: PostgreSQL + pgvector (Supabase)
- ORM: Drizzle (`packages/db`)
- Real-time: Socket.IO
- Auth: Campus JWT (Microsoft Entra + OTP; local test login off production only)
- Email/OTP: Resend (free tier)
- File storage: Supabase Storage; resume bytes deleted after parse
- Validation: Zod in `packages/types`
- Queue: Redis optional; campus workers may poll without Redis
- NLP: Python FastAPI (`nlp/` port **8001**), pretrained/zero-shot, CPU-only, no paid LLM APIs
- Monorepo: Turborepo

## Repo Structure

```
embedra/
├── web/
├── api/
├── nlp/
├── packages/db/
├── packages/types/
├── PRD.md · Architecture.md · RULES.md · DESIGN.md · TASKS.md · MEMORY.md
└── AGENTS.md
```

## Hard Rules
1. **No paid third-party LLM APIs.** Self-hosted pretrained models only. No fine-tuning.
2. **No new infrastructure without asking.** Stack is finalized.
3. **Express stays separate from Next.js.** Never move campus API into App Router server actions.
4. **NLP lives only in `nlp/`.** Express calls it over HTTP.
5. **Shared Zod only in `packages/types/`.**
6. **Follow DATA.md for schema.** Update DATA.md before migrations/columns.
7. Prefer `TASKS.md` over old PHASES.md for campus work; do not invent Phase 5 features mid-sprint.
8. **Slow work is queued/polled**, not awaited inline in handlers (NLP, OCR, mail, GitHub check).
9. **No open DMs, no versioning, no blocking, no idea takedown, no active push notifications, no organizations-as-entities.** Engagement-scoped threads are allowed (MEMORY.md, 2026-11-15).
10. **Community bans** (if any) are one-community only. Platform suspension is admin-only with a reason and an appeal.
11. **Owner cannot rate their own idea.** Ratings tenure/freeze rules still apply where ratings exist.
12. **Contribution / receipt pending until owner signs.**
13. **All list endpoints are cursor-paginated.**
14. **Never hold users' money.** No custodial balances, pooled funds or payout routing. Payments are off-platform and only recorded (RULES.md 13–19).

Also see `RULES.md` for product privacy (CGPA, resume deletion, university from email).

## Coding Conventions
- TypeScript in `web/` and `api/`; typed Python in `nlp/` where reasonable
- Infer TS types from Zod; do not hand-duplicate interfaces
- Clarity over cleverness
- New endpoints: Zod in + out (or documented shape) + `API.md` row

## When Uncertain
If ambiguous and not covered in PRD / DATA / RULES / MEMORY, stop and ask — especially auth, ratings, moderation, or multi-user data.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

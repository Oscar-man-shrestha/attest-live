# RULES.md — Non-negotiables

Agents and humans: break these only with an explicit user decision recorded in MEMORY.md.

## Product
1. Campus domain only for sign-in until another campus is approved.
2. No DMs. No user-facing idea takedown. No platform-wide bans. No active push notifications.
3. Owner cannot rate their own idea (legacy ratings). Skills are signed only via receipts.
4. Contribution / receipt defaults stay pending until owner signs.
5. Community bans (if ever) are one-community scoped.
6. University from verified email is not editable.
7. CGPA is never on the public profile; only self + idea owner on offers.
8. Resume and idea-brief files are parsed then deleted. Do not store binaries long-term.
9. Likes are social; signatures are proof. Do not treat likes as verified skill.
10. Forks are allowed on viewable ideas; fork copies only the public slice for that idea’s visibility and never the private approach; fork does not alter the source.
11. Idea visibility is owner-chosen (`minimal` \| `standard` \| `open`). List/detail APIs must not leak gated fields to non-members.
12. Ideas and Problems are separate boards (indigo vs amber). Do not merge their CTAs or card badges.

## Engineering (also in AGENTS.md)
1. No paid LLM APIs. NLP is self-hosted, pretrained, CPU-only, no fine-tuning.
2. No new infra (Kafka, GraphQL, new DB…) without asking.
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

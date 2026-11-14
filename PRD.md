# PRD.md — Attest (campus sprint)

Attest is a 14-day campus sprint where Amrita Bengaluru students post **ideas** and **problems**, find teammates by skills and interests, ship something small, and leave a **signed proof** trail. It is not LinkedIn, not Reddit, and not a college portal — it borrows the useful parts of each for one job: *find people and finish something in two weeks*.

Older “Embedra global idea platform” language below Phase notes is legacy. **Ship campus-first.**

## 1. Who it is for
- Primary: engineering students with `@bl.students.amrita.edu` mailboxes
- First session: Outlook sign-in (or OTP), short profile, then the **Ideas** board
- Not for faculty login, not for public internet accounts

## 2. Jobs to be done (student POV)

| When I… | I want to… | So that… |
| --- | --- | --- |
| Have two free weekends | Post a clear idea or problem in minutes | Others can join without a long pitch deck |
| Open Ideas | See builds I can actually help with | I don’t confuse them with campus Problems |
| Open Problems | Name a pain and invite a builder | Someone else can own the idea |
| Like someone’s skills | See proof (signed tasks, GitHub, projects) | I don’t bet on self-report alone |
| Ask to join | Send a structured offer (plan, skills, phases, hours, links) | The owner can accept / tryout / decline fast |
| Finish a sprint | Keep a proof page of signed work | Placements and next teams can trust me |
| Fork a stalled idea | Remix the **public slice** with credit | Abandoned work still becomes useful without leaking private approach |

## 3. Core objects
- **User** — verified campus email, branch, semester, skills ≤8, interests, two-week line, optional CGPA + proof fields; LinkedIn-light profile (cover/avatar, follow, signed trail)
- **Idea** — owner-chosen visibility (`minimal` \| `standard` \| `open`); teaser → apply → unlock; private approach unless Open; team workspace; optional small-build hour cap; capped images
- **Problem** — campus pain others turn into an idea; amber board separate from Ideas
- A Problem reporter keeps source credit when a proposal becomes an Idea; accepting does not make the reporter a build teammate. Joining remains an explicit offer and acceptance.
- **Offer** — join request with hours/days/links **plus skills/phases/plan**; statuses: new → tryout → accepted | declined
- **Task / receipt** — signed work is the only “verified skill”
- **Interaction / reaction / comment** — board personalization and discussion (not proof)
- **Circle** — soft clustering of similar profiles for discovery and ranking

## 4. Screens (canonical routes)

| Route | Job |
| --- | --- |
| `/` | Public first page: Attest hero + Ideas / Problems columns, then CTA to sign in |
| `/login` | Outlook + optional email code |
| `/profile` | Setup wizard (who → proof → interests → skills) |
| `/profile/[id]` | Public LinkedIn-inspired profile + posts |
| `/ideas` | Ideas board: For you / Latest with like comment share save; OPEN / FULL seats |
| `/problems` | Problems board (amber): report pain, propose idea |
| `/ideas/new`, `/ideas/[id]`, `/ideas/[id]/work` | Create (visibility + brief autofill + images), teaser/detail, member workspace |
| `/problems/new`, `/problems/[id]` | Report a problem; propose an idea |
| `/people` | Students like you + invite to open idea |
| `/offers/[id]` | Owner decides; sees private proof fields |
| `/inbox`, `/invites/[id]` | Offers, invites, notices |
| `/proof` | Signed lines; off until published |
| `/reports`, `/help` | Spam/copied work; rules answers |

Logged-out: `/` and `/login` only. Everything else needs a session.

## 5. Trust model
- **Social trust:** likes, comments, shares, saves → feed ranking and conversation
- **Work trust:** signed receipts, shipped ideas, GitHub public stats, listed projects/certs
- **Do not** conflate the two. A viral like is not a signature.

## 6. Discovery (what “good” feels like)
Inspired by Reddit/Medium/GitHub, applied to campus:
- **Reddit:** reason lines (“why this card”), comments with replies, share, save, “not interested”
- **Medium:** readable idea pitch, topics, author context, “more like this”
- **GitHub:** fork remixes the public slice only and credits the source; proof is a trail of work, not a bio essay
- **LinkedIn (light):** profile sections and matchable skills — without recruiter spam or DMs

Personalization stack (built): profile + behaviour embeddings, skill/role match, peer CF, circle/cohort engagement, freshness, MMR diversity.

## 7. Explicit non-goals (v1 campus)
- DMs / blocking / platform-wide bans
- Faculty dashboards
- Paid LLM APIs or fine-tuning
- Idea versioning / takedown by users
- Active push notifications

## 8. Success metrics (next real cohort)
- Profile complete rate within 10 minutes of first login
- % of open ideas with ≥1 offer in 48h
- % of accepted teams that post a day-7 check-in
- Signed receipts per shipped idea
- 7-day return rate to For you feed

## 9. Relationship to legacy Embedra
Embedra’s global ideas, communities, ratings tenure, and contribution log remain in the codebase and older PHASES. Attest campus sprint is the product we are activating for Amrita Bengaluru first. Do not rebuild those systems unless TASKS.md says so.

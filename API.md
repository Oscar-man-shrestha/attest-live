# API.md — Endpoint Reference

## Conventions
- All request/response bodies validated via Zod schemas in `packages/types/`.
- Auth required on all routes except where marked **Public**.
- Auth via `Authorization: Bearer <JWT>` header.
- Campus list endpoints use cursor pagination (`?cursor=` and a documented page size); legacy endpoints are documented separately below.
- Base path: `/api/v1`
- Production API requires `JWT_SECRET`, `DATABASE_URL`, and `WEB_ORIGIN` (or `CORS_ORIGINS`).

---

## Ops
| Method | Route | Notes |
|---|---|---|
| GET | `/health` | **Public.** `{ status, timestamp, nlp, workers }`. Returns 503 in production when NLP is down. |

---

## Auth
| Method | Route | Notes |
|---|---|---|
| POST | `/auth/signup` | **Public.** Create user account |
| POST | `/auth/login` | **Public.** Returns JWT |
| POST | `/auth/logout` | Invalidate session (if using refresh tokens) |
| GET | `/auth/me` | Return current authenticated user |

---

## Users / Profile
| Method | Route | Notes |
|---|---|---|
| GET | `/users/:id` | **Public.** Profile page data |
| PATCH | `/users/me` | Update own profile (bio, links, pic) |
| GET | `/users/:id/ideas` | **Public.** Ideas owned by user |
| GET | `/users/:id/groups` | Active groups user is in (own profile only, or public subset) |
| GET | `/users/:id/contributions` | **Public.** Approved contributions only |
| POST | `/users/:id/follow` | Follow a user |
| DELETE | `/users/:id/follow` | Unfollow |
| GET | `/users/:id/followers` | **Public.** |
| GET | `/users/:id/following` | **Public.** |
| GET | `/users/me/saved-ideas` | Ideas the user has saved |
| POST | `/users/me/skills` | Add a skill tag |
| DELETE | `/users/me/skills/:skillId` | Remove a skill tag |

---

## Skills / Domains (fixed lookups)
| Method | Route | Notes |
|---|---|---|
| GET | `/skills` | **Public.** Full fixed list |
| GET | `/domains` | **Public.** Full fixed list |

---

## Ideas
| Method | Route | Notes |
|---|---|---|
| POST | `/ideas` | Create idea |
| GET | `/ideas/:id` | **Public.** Idea page (README, owner, tags, rating, member/activity summary, looking-for list). `invite_token` is included only in the owner's view. |
| PATCH | `/ideas/:id` | Update idea (owner only) |
| DELETE | `/ideas/:id` | Owner only — deletes idea and cascades (group, members, messages, join requests) |
| POST | `/ideas/:id/close` | Owner marks idea as closed |
| POST | `/ideas/:id/fork` | Any authenticated user forks idea they can view → creates new idea with `forked_from_id` set, `community_id` copied from source |
| GET | `/ideas/:id/forks` | **Public.** Returns fork count only (`{ count: number }`), not a list — avoids clutter when many people fork the same idea |
| POST | `/ideas/:id/request-join` | Spectator requests access (type: open+open only) |
| GET | `/ideas/:id/join-requests?cursor=&limit=` | Owner only — lists join requests. Cursor-paginated on `created_at`, descending. Default `limit=50`. Response includes `nextCursor`. |
| PATCH | `/ideas/:id/join-requests/:requestId` | Owner only — accept/reject a join request |
| POST | `/ideas/:id/looking-for` | Owner adds a skill to "Looking for" list (body `{ skillId }`, rejects duplicates) |
| DELETE | `/ideas/:id/looking-for/:skillId` | Owner removes it |
| POST | `/ideas/:id/regenerate-invite` | Owner invalidates the old invite token and generates a new one |
| POST | `/ideas/join-via-invite/:token` | Auth required. Joins an open_closed, open idea directly via shareable invite token |
| POST | `/ideas/:id/save` | Save idea to user's saved list |
| DELETE | `/ideas/:id/save` | Unsave |

## Idea Images
| Method | Route | Notes |
|---|---|---|
| POST | `/ideas/:id/images` | Upload image (idea page) → R2 |
| DELETE | `/ideas/:id/images/:imageId` | Remove (owner or uploader) |

## Idea Comments
| Method | Route | Notes |
|---|---|---|
| GET | `/ideas/:id/comments` | **Public.** Threaded (includes `parent_comment_id`) |
| POST | `/ideas/:id/comments` | Add comment or reply |
| DELETE | `/ideas/:id/comments/:commentId` | Author or owner |

---

## Groups
| Method | Route | Notes |
|---|---|---|
| GET | `/groups/:id` | Contributors only — group page data |
| GET | `/groups/:id/members?cursor=&limit=` | Contributors only. Cursor-paginated on `joined_at`, descending. Default `limit=50`. Response includes `nextCursor`. |
| POST | `/groups/:id/members` | Owner adds a member |
| DELETE | `/groups/:id/members/:userId` | Owner removes a member (sets `left_at`) |
| GET | `/groups/:id/messages?cursor=&limit=` | Contributors only. Cursor-based pagination on `created_at`, descending (most recent first). Default `limit=50`. Response includes `nextCursor` for loading older messages. |
| — | Socket.IO channel `/groups/:id` | Real-time message send/receive, not REST |

---

## Ratings
| Method | Route | Notes |
|---|---|---|
| POST | `/ideas/:id/rating` | Submit/update rating (contributor, tenure-gated, not owner) |
| GET | `/ideas/:id/rating` | **Public.** Current avg + count (cached fields) |

---

## Contributions (log)
| Method | Route | Notes |
|---|---|---|
| GET | `/ideas/:id/contributions` | **Public.** Approved-only for non-owners; owner/author see all statuses |
| POST | `/ideas/:id/contributions` | Contributor submits entry → `pending` |
| PATCH | `/contributions/:id/approve` | Owner only |
| PATCH | `/contributions/:id/reject` | Owner only |

---

## Communities
| Method | Route                      | Notes                                                                   |
| ------ | -------------------------- | ----------------------------------------------------------------------- |
| GET    | `/communities`             | **Public.** List/search (autocomplete uses this + embeddings)           |
| GET    | `/communities/:id`         | **Public.** Community info                                              |
| POST   | `/communities`             | Create new (triggers OTP flow if domain doesn't exist)                  |
| POST   | `/communities/:id/join`    | Existing community — starts OTP verification                            |
| POST   | `/communities/verify-otp`  | Submit OTP code, completes join, checks Redis                           |
| GET    | `/communities/:id/ideas`   | Only members of community can see this. Ideas scoped to this community. |
| GET    | `/communities/:id/members` | Members only                                                            |

---

## Feed / Search
| Method | Route | Notes |
|---|---|---|
| GET | `/feed` | Personalized feed (embedding-based, global by default) |
| GET | `/feed?community=:id` | Feed toggled to a specific community |
| GET | `/search?q=` | Semantic search over ideas; supports `&status=` `&rating=` filters |

### Campus sprint personalization (built)
All under `/campus`, auth required. Zod schemas in `packages/types/campus.ts`.

| Method | Route | Input | Output |
|---|---|---|---|
| GET | `/campus/feed?cursor=` | `feedQuerySchema` | `{ ideas: (idea & { reasons: string[], topics: string[] })[], nextCursor, personalized, usingModel, suggestedInterests: string[] }`. 20 per page, 60 ranked at most |
| POST | `/campus/interactions` | `interactionSchema` `{ ideaId, kind: view \| dwell \| not_interested \| undo_not_interested, dwellMs? }` | `{ ok: true }`. Views dedupe for 30 minutes; dwell under 3 s is dropped |
| POST | `/campus/profile/interests` | `addInterestSchema` `{ label }` | `{ interests: string[] }`. Label must be in `INTEREST_POOL`; cap 20 |
| GET | `/campus/interests/related` | | `{ related: Record<label, string[]> }`. Six nearest labels by embedding; empty while the NLP service is down |
| GET | `/campus/ideas/:id/similar` | | `{ ideas: (idea & { topics })[] }`. Up to 4 by pgvector cosine distance |
| POST | `/campus/ideas` | `createSprintIdeaSchema` (includes `visibility`, `blurb`) | `201 { idea }`. Teaser fields always; gated brief for non-members. Create cooldown ~30m; two-idea sprint cap |
| GET | `/campus/ideas/:id` | uuid | `{ idea }` with `briefLocked`, `images`, `approach` when allowed by membership/visibility; linked ideas include `problemSource: { id, title, reporterName: string \| null }` (`null` name when reporter hid it) |
| GET | `/campus/people?scope=&cursor=` | `peopleQuerySchema` (`all` \| `branch` \| `cohort` = same branch and semester) | `{ people: { id, displayName, branch, semester, degree, university, headline, interests, skills, githubLogin, circle, sharedInterests, sharedSkills, match, reasons }[], nextCursor, circle, circles, myOpenIdeas, usingModel }`. 20 per page, 100 ranked. Public fields only; no email, CGPA, certifications, projects or experience |
| POST | `/campus/people/:id/invite` | `invitePersonSchema` `{ ideaId }` | `{ invited: true }`. Sends the existing sprint invite for one of your open ideas; the email is looked up server-side |
| GET | `/campus/interests/popular?branch=` | `branchPopularityQuerySchema` | `{ interests: string[], skills: string[], students }`. Labels ordered by how many students in the branch picked them; labels with fewer than 2 picks are left out |
| POST | `/campus/documents` | multipart: `file` (PDF, PNG or JPG, 5 MB max) + `kind` per `uploadDocumentSchema` (`resume` \| `certificate` \| `idea_brief`) | `202 { id, status: "queued" }`. Five uploads per user per hour overall; idea_brief also capped at 3/hour. Bytes deleted after parse. 415/413 as before |
| GET | `/campus/documents/:id` | `documentIdSchema` | `{ id, kind, filename, status, result, error }`. For `idea_brief`, `result.ideaBrief` suggests title/blurb/pitch/audience/gap/ships/approach |

### Campus posts: likes, comments, shares, profiles (built)
Every idea returned by `/campus/ideas`, `/campus/feed`, `/campus/ideas/:id`, `/campus/ideas/:id/similar` and `/campus/people/:id/ideas` carries `engagement: { likes, liked, comments, shares }` for the viewer. Logic lives in `api/src/services/social.ts` and `api/src/services/profileService.ts`.

| Method | Route | Input | Output |
|---|---|---|---|
| GET | `/campus/ideas/:id/comments?sort=&cursor=` | `commentsQuerySchema` (`top` \| `new`) | `{ comments: Comment[], nextCursor, total }`. 20 top-level comments per page, each with up to 2 reply previews in `replies` |
| POST | `/campus/ideas/:id/comments` | `sprintCommentSchema` `{ body (1–2000), parentId? }` | `201 { comment: Comment }`. A reply to a reply is filed under its top-level comment. 20 comments per user per 10 minutes (429 after) |
| GET | `/campus/comments/:id/replies?cursor=` | `commentsQuerySchema` | `{ replies: Comment[], nextCursor }`. Oldest first, 20 per page |
| DELETE | `/campus/comments/:id` | | `{ deleted: true }`. Comment author, idea owner or admin. Soft delete: the body becomes `null` and `deleted: true` so replies keep their thread |
| POST | `/campus/reactions` | `reactionSchema` `{ targetType: idea \| comment, targetId }` | `{ liked: true, likes }`. One like per user per target; you cannot like your own idea or comment (400) |
| DELETE | `/campus/reactions` | `reactionSchema` | `{ liked: false, likes }` |
| POST | `/campus/ideas/:id/share` | | `{ shares }`. Records a `share` interaction; repeat shares by the same user within 30 minutes count once |
| GET | `/campus/people/:id` | uuid | `{ profile, stats, teams, currentlyWorking, signedTrail }`. Profile adds cover/avatar, follow counts, `viewerFollows`, `activityStreak`, `currentlyWorkingOn`. CGPA only for self |
| GET | `/campus/people/:id/ideas?cursor=` | `feedQuerySchema` | `{ ideas: (idea & { engagement })[], nextCursor }`. 10 per page; gated fields respect visibility for non-members |
| POST | `/campus/people/:id/follow` | | `{ following: true }` |
| DELETE | `/campus/people/:id/follow` | | `{ following: false }` |
| POST | `/campus/profile/media/:slot` | multipart `image`; `slot` = `avatar` \| `cover` | `201 { url, slot }`. ≤5 MB PNG/JPG/WebP |
| POST | `/campus/ideas/:id/images` | multipart `image` | `201 { id, imageUrl, role }`. Owner only; max 3 (1 hero + 2 figures); ≤5 MB |
| DELETE | `/campus/ideas/:id/images/:imageId` | | `{ ok: true }` |
| POST | `/campus/saves` | `saveSchema` `{ targetType: idea \| problem, targetId }` | `{ saved: true }` |
| DELETE | `/campus/saves` | `saveSchema` | `{ saved: false }` |
| GET | `/campus/saves?cursor=` | | `{ ideas: (idea & { images, forkCount })[], problems?: problem[], nextCursor }`. Bookmarked ideas (paginated) + saved problems on first page |
| POST | `/campus/ideas/:id/fork` | | `{ idea }`. Copies public slice for source visibility only; never private approach; forks skip the two-idea cap |

Problem DTOs return `authorId: null` to other students when the reporter hides their name. Idea DTOs return `ownerId: null` to nonmembers when the author hides their name. Owners still receive their own ID. Accepting a proposal on a Problem creates an Idea owned by the proposer and credits the linked Problem; the reporter is not automatically added to the build team.

### Campus workspace, tasks, and proof
| Method | Route | Input | Output |
|---|---|---|---|
| GET | `/campus/ideas/:id/work` | uuid | `{ idea, approach, roster, tasks, checkIns, reopenedUserIds, day7, endsAt, isAuthor }`. Team only; checks and applies day-7 reopening |
| POST | `/campus/ideas/:id/check-in` | `checkInSchema` `{ done, stuck, next }` | `{ checkIn }`. Recorded for day-7 checkpoint and blocker visibility |
| POST | `/campus/ideas/:id/tasks` | `addTaskSchema` `{ title, description?, role?, assigneeId? }` | `201 { task }`. Author only; assignee must be on team |
| POST | `/campus/tasks/:id/start` | | `{ task }`. Assignee only; marks task `in_progress` |
| PATCH | `/campus/tasks/:id` | `updateTaskSchema` `{ description, links }` | `{ task }`. Assignee only; updates draft before submit |
| PATCH | `/campus/tasks/:id/assignee` | `reassignTaskSchema` `{ assigneeId? }` | `{ task }`. Author only; reassigns unsubmitted/unfrozen task to team member |
| POST | `/campus/tasks/:id/submit` | | `{ task }`. Assignee only; freezes task content for witness signature |
| POST | `/campus/tasks/:id/sign` | | `{ task }`. Teammate only (cannot sign own task); creates signed proof receipt |
| POST | `/campus/tasks/:id/dispute` | | `{ task }`. Author only; marks receipt as disputed |
| POST | `/campus/ideas/:id/ship` | | `{ idea }`. Author only; closes active sprint and enables proof publishing |
| POST | `/campus/ideas/:id/invite` | `inviteMemberSchema` `{ email }` | `{ invited: true }`. Author only; invites collaborator by campus email |
| POST | `/campus/ideas/:id/remove` | `removeMemberSchema` `{ userId, reason }` | `{ ok: true }`. Author only; removes collaborator |
| POST | `/campus/ideas/:id/leave` | | `{ ok: true }`. Collaborator leaves team; submitted work stays frozen |
| GET | `/campus/invites/:id` | uuid | `{ invite, idea: { id, title, blurb, stage, teamStatus, helpNeeded, seatsOpen, collaboratorCount }, owner }`. Invitee only |
| POST | `/campus/invites/:id` | `{ action: accept \| decline }` | `{ status, ideaId? }`. Accept adds collaborator when seats open |
| GET | `/campus/inbox` | | `{ summary, actions, incoming, outgoing, invites, notices, signatures }`. Incoming offers ranked by MiniLM fit + skill/branch/proof signals. Triggers Day-7 checks |
| GET | `/campus/inbox/badge` | | `{ count, unreadNotices, pendingOffers, pendingInvites, awaitingSignature }` for nav badge |
| POST | `/campus/notices/:id/read` | uuid | `{ ok: true }` |
| POST | `/campus/notices/read-all` | | `{ ok: true }` |
| GET | `/campus/proof` | | `{ published, displayName, lines }`. Verified proof receipts for viewer |
| POST | `/campus/proof` | `{ published: boolean }` | `{ published }`. Toggle public visibility of signed proof receipts |

`Comment` is `{ id, parentId, body \| null, deleted, createdAt (ISO UTC), author: { id \| null, name, branch, semester, headline, isIdeaAuthor }, likes, liked, replyCount, mine, canDelete, replies }`. When the idea hides its author's name, that author's comments show as "Idea author" with `id: null`. No notifications are sent for likes, comments or replies (AGENTS rule 9).

People ranking and circles are described at the top of `api/src/services/peers.ts`. Circles are spherical k-means over profile embeddings blended with picked-interest vectors, k chosen by silhouette, recomputed at most every ten minutes. The feed's cohort signal uses the viewer's circle plus branch-semester classmates.

Uploads are parsed by `api/src/queues/documentQueue.ts`, which sends them to NLP `POST /parse-document` and deletes the file bytes once parsed or failed. Nothing is written to the profile: the web review step shows `result` and the student saves what they keep through `PUT /campus/profile`. Resume project titles shorter than 6 characters, section leftovers, and single-token tech crumbs are dropped in `nlp/extractors/resume.py`; the Proof step still asks the student to keep/discard suggestions. The same worker checks a saved GitHub link against the public GitHub API and fills `github_login` and `github_stats`. That confirms the profile exists, not that the student owns it.

Day-7 check-in reminders are polled by `api/src/queues/day7Queue.ts` (every ~5 minutes once mid-sprint). They write `events.kind = day7_reminder`, an in-app notice, and optional mail. Opening a workspace still applies the Anvil reopen rules for teammates who never checked in.

Ranking is described at the top of `api/src/services/recommender.ts`. Embeddings are filled by `api/src/queues/embeddingQueue.ts`, a background worker that polls for null vectors, so no request waits on the NLP service. It stands in for BullMQ until Redis is configured.

---

## Reports
| Method | Route | Notes |
|---|---|---|
| POST | `/reports` | Submit report `{ target_type, target_id, community_id?, reason }` |
| GET | `/reports` | Admin/reviewer only — the unified queue |
| PATCH | `/reports/:id/resolve` | Admin/reviewer only — sets `status`, `resolution` |

---

## NLP Service (internal — called by `api`, not exposed to `web`)
| Method | Route | Notes |
|---|---|---|
| POST | `/nlp/embed` | Text → vector (feed, search, dup-detection). Built as `POST /embed` on port 8001, see `nlp/NLP.md` |
| POST | `/parse-document` | Built. `{ kind, mimeType, contentBase64, skillVocab: {label, keywords}[] }` → `DocumentExtraction`. PDF text layer first, RapidOCR for scans and images. See `nlp/NLP.md` |
| POST | `/nlp/caption` | Image → caption text (BLIP) |
| POST | `/nlp/extract-skills` | Bio text → skill tag suggestions |
| POST | `/nlp/classify-report` | Report text → category |
| POST | `/nlp/summarize` | Group message history → summary |
| POST | `/nlp/draft-contribution` | Raw input → structured contribution draft |

All NLP calls from `api` are queued via BullMQ, not called synchronously inline in a request handler (per AGENTS.md rule 8).

## Marketplace Phase 1 (added 2026-11-15)

All under `/api/v1/campus`, JWT required. Zod schemas live in `packages/types/campus.ts`. Lists are cursor-paginated. Suspended users get 403 on every write except `POST /me/appeal`. Attest never holds money: payment routes only record what happened off-platform.

| Method | Path | Zod in | Notes |
|---|---|---|---|
| GET | `/engagements` | `cursorQuerySchema` | Your deals (requester or builder), 20 per page, `needsYou` flag |
| POST | `/engagements` | `createEngagementSchema` | Idea owner proposes a deal to an active teammate. Paid types need both 18+; builder max 2 active paid deals; `notAcademicWork: true` required |
| GET | `/engagements/:id` | — | Parties (or admin) only. Milestones, payments, reviews (hidden until both submit or 14 days) |
| POST | `/engagements/:id/accept` | — | Builder accepts → `active` |
| POST | `/engagements/:id/cancel` | `cancelEngagementSchema` | Either party, while proposed/active; reason shown to the other |
| POST | `/engagements/:id/review` | `reviewSchema` | After completion; once per party |
| GET | `/engagements/:id/messages` | `cursorQuerySchema` | Engagement-scoped thread, newest first, 30 per page |
| POST | `/engagements/:id/messages` | `engagementMessageSchema` | Open while proposed/active; payment handles/phones get `flag: contact_details` + warning |
| POST | `/milestones/:id/submit` | `submitMilestoneSchema` | Builder; 1–6 links; starts 7-day acceptance window |
| POST | `/milestones/:id/accept` | — | Requester |
| POST | `/milestones/:id/dispute` | `disputeMilestoneSchema` | Requester; builder resubmits |
| POST | `/milestones/:id/payment` | `recordPaymentSchema` | Requester records an off-platform payment (method + receipt ID, never account numbers) |
| POST | `/milestones/:id/payment/confirm` | — | Builder confirms receipt → `payment_confirmed`; all done → deal `completed` |
| GET | `/people/:id/record` | — | Review distributions (never averages) + deal record for profiles |
| PUT | `/me/handle` | `updateHandleSchema` | Rename public handle |
| POST | `/me/adult` | `confirmAdultSchema` | Self-confirm 18+ (needed for paid deals) |
| PUT | `/me/privacy` | `privacySchema` | `showInstitution` |
| POST | `/me/appeal` | `appealSchema` | Suspended users only |
| GET | `/admin/integrity` | `cursorQuerySchema` | Admin: pending coursework flags + suspension appeals |
| POST | `/admin/integrity/:id` | `resolveIntegrityFlagSchema` | Admin: `clear` or `confirm` (confirm hides the post / cancels the deal; never suspends) |
| POST | `/admin/users/:id/suspend` | `suspendUserSchema` | Admin; reason required; user is emailed and can appeal |
| POST | `/admin/users/:id/unsuspend` | — | Admin |

Changed: `POST /auth/campus/request-code` and `/verify` accept any academic email (`isAcademicEmail`). `POST /auth/signup` and `/auth/login` return 410. `POST /campus/ideas` takes `dealType`, `currency`, `budget`, `licence`, `notAcademicWork`; `POST /campus/problems` takes `notAcademicWork`.

## Campus layer and gigs (added 2026-11-15)

Campus = same verified email domain. Campus-only ideas and gigs return 404 / are left out of every list for other domains.

| Method | Path | Zod in | Notes |
|---|---|---|---|
| GET | `/campus/ideas?campus=1` | — | Only ideas from the viewer's campus. Cards carry `sameCampus`, `campusOnly` |
| GET | `/campus/feed?campus=1` | `feedQuerySchema` | For-you feed limited to the viewer's campus |
| GET | `/campus/problems?campus=1` | — | Problems from the viewer's campus. Cards carry `sameCampus` |
| GET | `/campus/people?scope=campus` | `peopleQuerySchema` | People on the viewer's email domain |
| POST | `/campus/ideas` | `createSprintIdeaSchema` | New optional `campusOnly` |
| GET | `/campus/gigs` | `gigListQuerySchema` | `kind=request\|offer`, `campus=1`, `category`, `mine=1`, cursor. Open, visible gigs, 20 per page |
| POST | `/campus/gigs` | `createGigSchema` | Paid gigs need the author 18+; `notAcademicWork: true` required; max 5 open gigs |
| GET | `/campus/gigs/:id` | — | Author sees all responses; a responder sees only their own |
| POST | `/campus/gigs/:id/respond` | `gigResponseSchema` | Once per user; not the author; paid gigs need the responder 18+ |
| POST | `/campus/gigs/:id/close` | — | Author only |
| POST | `/campus/gig-responses/:id/accept` | — | Author only. Creates an **active** one-milestone engagement and returns `engagementId`. A request gig closes; an offer stays open |
| POST | `/campus/gig-responses/:id/decline` | — | Author only |

Engagement responses now include `title` and `gig` (idea may be null for gig deals); deal summaries include `isGig`.

## Demand signal and team thread (added 2026-11-15)

| Method | Path | Zod in | Notes |
|---|---|---|---|
| POST / DELETE | `/campus/ideas/:id/want` | — | "I'd use this". Not the owner. Returns `{ wanted, wants, campusWants }`. Idea cards carry the same three fields inside `engagement` |
| GET | `/campus/ideas/:id/thread` | `cursorQuerySchema` | Team thread, newest first, 30 per page. Owner and active team members only; everyone else gets 404 |
| POST | `/campus/ideas/:id/thread` | `engagementMessageSchema` | 1–2000 chars, 10 per minute. Teammates get one in-app notice per idea per 6 hours (no email) |

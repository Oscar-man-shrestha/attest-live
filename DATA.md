# DATA.md — Schema Reference

## users
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| username | text, unique | |
| email | text, unique | |
| password_hash | text | bcrypt |
| bio | text | |
| profile_pic_url | text | |
| socials | jsonb | |
| project_links | jsonb | |
| created_at | timestamp | |

## skills
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text, unique | fixed lookup list |

## user_skills
| Column | Type | Notes |
|---|---|---|
| user_id | FK users | |
| skill_id | FK skills | |

## follows
| Column | Type | Notes |
|---|---|---|
| follower_id | FK users | |
| following_id | FK users | |

## domains
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text, unique | fixed lookup list |

## ideas
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| owner_id | FK users | |
| title | text | |
| description | text | README-style writeup |
| domain_id | FK domains | |
| community_id | FK communities, nullable | NULL = global/public idea; set = belongs to one community (ASSUMPTION: idea belongs to at most one community — confirm if cross-posting to multiple communities is needed instead) |
| access_type | enum(open_open, open_closed, closed) | |
| status | enum(open, closed) | |
| embedding | vector | pgvector, for feed/search/dup-detection |
| forked_from_id | FK ideas, nullable | self-reference, lineage |
| invite_token | text, nullable, unique | shareable join link for open_closed ideas; generated at creation/regeneration |
| avg_rating | numeric, nullable | cached, recomputed on rating change/freeze |
| rating_count | int, default 0 | cached, recomputed on rating change/freeze |
| created_at | timestamp | |

## idea_looking_for
| Column | Type | Notes |
|---|---|---|
| idea_id | FK ideas | |
| skill_id | FK skills | |

## idea_images
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| idea_id | FK ideas | |
| user_id | FK users | uploader |
| image_url | text | stored in Cloudflare R2 |
| created_at | timestamp | |

## saved_ideas
| Column | Type | Notes |
|---|---|---|
| user_id | FK users | |
| idea_id | FK ideas | |
| created_at | timestamp | |

## groups
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| idea_id | FK ideas, unique | strict 1-to-1 with idea |

## group_members
| Column | Type | Notes |
|---|---|---|
| group_id | FK groups | |
| user_id | FK users | |
| joined_at | timestamp | used for rating tenure gate |
| left_at | timestamp, nullable | used for rating freeze-on-exit |

## group_messages
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| group_id | FK groups | |
| user_id | FK users | |
| content | text | |
| image_url | text, nullable | stored in Cloudflare R2 |
| created_at | timestamp | |

## join_requests
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| idea_id | FK ideas | |
| user_id | FK users | requester |
| status | enum(pending, accepted, rejected) | |
| created_at | timestamp | |

## idea_comments
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| idea_id | FK ideas | |
| user_id | FK users | |
| parent_comment_id | FK idea_comments, nullable | self-reference; NULL = top-level, set = reply |
| content | text | |
| image_url | text, nullable | |
| created_at | timestamp | |

## ratings
| Column | Type | Notes |
|---|---|---|
| idea_id | FK ideas | |
| user_id | FK users | |
| value | int | |
| updated_at | timestamp | changeable while member; unique on (idea_id, user_id) |

## contributions
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| idea_id | FK ideas | |
| user_id | FK users | |
| content | text | |
| link | text, nullable | |
| status | enum(pending, approved, rejected) | |
| created_at | timestamp | |

## communities
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text | display name, from first submission |
| email_domain | text, unique | actual identity key, not the name |
| created_at | timestamp | |

## community_members
| Column | Type | Notes |
|---|---|---|
| community_id | FK communities | |
| user_id | FK users | |
| joined_at | timestamp | permanent membership, no expiry |

*Note: OTP codes themselves are NOT stored in Postgres — they live in Redis with a short TTL (`otp:{email}` key, expires in minutes). A `community_members` row only exists once OTP verification succeeds, so its existence is the record of "this user is verified for this community."*

## community_bans
| Column | Type | Notes |
|---|---|---|
| community_id | FK communities | |
| user_id | FK users | |
| banned_until | timestamp | |
| reason | text | |

## reports
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| reporter_id | FK users | |
| target_type | enum(idea, user, community) | |
| target_id | uuid | polymorphic reference |
| community_id | FK communities, nullable | filled only when source = community |
| reason | text | |
| classification | text, nullable | NLP-assigned category |
| status | enum(pending, reviewed) | |
| resolution | text, nullable | |
| created_at | timestamp | |

## Relationships Summary
- User 1—N Ideas (owner)
- User N—N Skills (via user_skills)
- User N—N Users (via follows)
- Idea N—N Skills (via idea_looking_for)
- Idea 1—N idea_images
- Idea 1—1 Group
- Group N—N Users (via group_members)
- Group 1—N group_messages
- Idea 1—N idea_comments (self-referencing via parent_comment_id for replies)
- Idea N—N Users (via ratings, contributions)
- Idea 1—N Idea (self-reference, forked_from_id)
- Idea N—1 Community (nullable — see assumption above)
- User N—N Communities (via community_members)
- Community 1—N community_bans
- User/Idea/Community 1—N reports (polymorphic via target_type/target_id)
- Idea 1—N Idea (self-reference, forked_from_id) — also used to compute live fork count via GET /ideas/:id/forks

## Campus sprint (Attest)

Added beside the tables above. Existing columns stay. A sprint idea is an `ideas` row whose `pitch` is set. The author is `owner_id` and is never also a `team_members` row.

### users (added columns)
| Column | Type | Notes |
|---|---|---|
| display_name | text, nullable | Required before posting |
| branch | text, nullable | CSE, AIE, ECE, EEE, ME, EAC |
| semester | int, nullable | 1–8 |
| campus_skills | jsonb string array | At most 8 |
| interests | jsonb string array | Up to 20 labels from `INTEREST_POOL`, plus any already saved. Used to rank "Picked for you" ideas |
| two_week_line | text, nullable | Required before posting |
| profile_embedding | vector(384), nullable | From interests, skills, the two-week line, headline, projects, and certifications. Set to null on profile save so the embedding worker redoes it |
| university | text, nullable | Set from the email domain at sign-in. Not editable, shown as verified |
| degree | text, nullable | Prefilled from the roll number (for example `en.u4` is B.Tech) |
| graduation_year | int, nullable | Prefilled as joining year + 4 |
| cgpa | numeric(4,2), nullable | Optional, 0 to 10. Only the student and owners of ideas the student asked to join see it |
| headline | text, nullable | One line, at most 120 characters |
| linkedin_url | text, nullable | linkedin.com only |
| github_login | text, nullable | Username from `github_url`, confirmed against the public GitHub API |
| github_stats | jsonb, nullable | `{ publicRepos, followers, topLanguages, checkedAt }` from the public GitHub API |
| projects | jsonb array | At most 6 `{ title, url?, summary? }` |
| certifications | jsonb array | At most 10 `{ name, issuer?, year?, url? }` |
| experience | jsonb array | At most 6 `{ role, org, period? }` |

CGPA is shown only to the student and to owners of ideas the student sent an offer to. The profile page, visible to signed-in campus students, shows the headline, university, degree, branch, semester, skills, interests, links, GitHub stats, projects, certifications, experience, and sprint record. Email is never shown.
| hours_per_week | int, nullable | Optional. Not on the first screen |
| available_days | jsonb string array | Optional |
| github_url | text, nullable | Optional |
| site_url | text, nullable | Optional |
| cover_url | text, nullable | Profile cover image URL (Supabase storage) |
| currently_working_on | text, nullable | Short line shown on profile (≤160 chars) |
| is_admin | boolean, default false | Reports queue only |

Login for the sprint is a one-time code to `@bl.students.amrita.edu`. The first code creates the user. `password_hash` is a random hash so the row still satisfies the existing column. OTP codes stay out of Postgres.

### sprints
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | One open row. Day 7 is seven days before `ends_at` |
| ends_at | timestamp | Closes new requests |
| created_at | timestamp | |

### ideas (added columns)
| Column | Type | Notes |
|---|---|---|
| pitch, audience, gap, ships | text, nullable | Public. Pitch and ships must be the student's own words |
| stage | text | idea, prototype, building, launched |
| team_status | text | open, in_build, shipped. Existing `status` enum is unchanged |
| help_needed | jsonb string array | Open roles |
| is_small, hour_cap | boolean, int | Together, when a first build can join |
| compensation_sentence | text | One sentence. Default volunteer |
| hide_name | boolean | Branch and semester still show |
| author_name, author_branch, author_semester | snapshot | `author_name` empty when hidden |
| problem_id | uuid, nullable, unique when set | Set when accepted from a problem. Immutable source |
| duplicate_of_id | uuid, nullable | Fork or near-duplicate. Skips the duplicate check and the two-idea cap |
| sprint_id | uuid, nullable | |
| hidden_at | timestamp, nullable | Set when a spam or copied-work report is filed |
| visibility | text, default standard | minimal \| standard \| open — owner-chosen public disclosure |
| blurb | text, nullable | Short public teaser (≤160 chars). Required when visibility is minimal |

`owner_id` is the idea author and is immutable.

**Visibility rules (non-members)**
- Always public: title, blurb, roles, stage, team_status, hour_cap, hero image, fork count, created_at
- Standard/Open also public: pitch, audience, gap, ships (and author name unless hide_name)
- Minimal gates pitch/audience/gap/ships until the viewer is an accepted teammate
- Approach + contact: team only, except Open makes approach body readable campus-wide (contact stays team-only)
- Docs / extracted technical notes: never public

### problems
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| author_id | uuid, immutable | Problem source |
| sprint_id | uuid | |
| title, what_happens, who_feels, fix_would_change | text | Public and complete |
| source | text | lived or heard |
| author_name, author_branch, author_semester, hide_name | | Same name rule as ideas |
| fresh_line | text, nullable | Day-7 refresh |
| hidden_at | timestamp, nullable | |
| created_at | timestamp | |

### approaches
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| idea_id or problem_id | uuid | One of them |
| body, contact_email | text | Author and accepted teammates only. Not selected on the public board |

### revisions
Append-only. `target_type`, `target_id`, `snapshot` jsonb, `created_at`. Rows are not updated.

### offers
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| builder_id | uuid | |
| idea_id or problem_id | uuid | One of them |
| sprint_id | uuid | One open offer per student per sprint |
| body, hours_per_week, available_days, links | | Freeze when sent |
| proposal | jsonb, nullable | Public idea fields when the offer proposes from a problem |
| skills | jsonb string array | Skills / strengths the applicant claims for this ask |
| phases | jsonb string array | Phases they want to own (e.g. backend, hardware, UI) |
| status | text | new, tryout, accepted, declined |

### tryouts
At most one per offer. `brief`, `hour_cap` (at most 8), `outcome`. Frozen at assignment.

### team_members
`idea_id`, `user_id`, `joined_at`, `left_at`, `exit_reason`. Cap is four including the author, so three active collaborator rows fill the team. The author is not inserted here.

### tasks
`title`, `description`, `links`, `role`, `status` (todo, in_progress, submitted, done, disputed), `assignee_id`, `receipt_status` (signed, submitted, disputed, removed), `frozen_at`, `signed_at`, `removed_at`, `witness_id`. No delete. Frozen text cannot be edited. A different teammate signs. Self-sign fails.

### check_ins
`idea_id`, `user_id`, `done`, `stuck`, `next`. One row per member.

### proof_pages
`user_id` PK, `published` default false.

### sprint_invites
`idea_id`, `email`, `status` (pending, accepted, declined). A seat is added only after accept.

### saves
`user_id`, `target_type` (idea or problem), `target_id`. Private. No public count.

### notices
`user_id`, `body`, `target_id`, `read_at`.

### events
Append-only log of join, kick, submit, signature, and declined tryouts. No client writes.

### interactions
Private feed signals. Only the ranker reads them; nobody sees another student's rows.
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK users | |
| idea_id | uuid, FK ideas | |
| kind | text | view, dwell, not_interested, share |
| dwell_ms | int, nullable | For dwell. Capped at 10 minutes |
| created_at | timestamp | |

Indexes on (user_id, created_at) and (idea_id). A view is stored at most once per student per idea per 30 minutes. Saves and offers count as signals from their own tables.

`ideas.embedding` is filled by the embedding worker, not in the request, and set to null when the public text changes.

### documents
Uploaded resumes, certificates, and idea briefs waiting to be read. The file is deleted after parsing; only the extracted fields stay, and only until the student reviews them.
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK users | |
| kind | text | resume, certificate, or idea_brief |
| filename | text | Original name |
| mime_type | text | application/pdf, image/png, image/jpeg |
| content | bytea, nullable | At most 5 MB. Set to null once parsed |
| status | text | queued, parsed, failed |
| result | jsonb, nullable | Extracted suggestions. For idea_brief includes `ideaBrief` { title, blurb, pitch, audience, gap, ships, approach } |
| error | text, nullable | |
| created_at, parsed_at | timestamp | |

Index on (status, created_at). A student has at most 5 documents in the last hour; idea_brief uploads are also capped at 3 per hour.

### reactions
Likes on sprint ideas and on comments. Counts are public; who liked is not listed.
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK users | |
| target_type | text | idea or comment |
| target_id | uuid | `ideas.id` or `idea_comments.id` |
| created_at | timestamp | |

Unique on (user_id, target_type, target_id); index on (target_type, target_id). An author cannot like their own idea or comment.

### idea_comments (added columns, sprint use)
| Column | Type | Notes |
|---|---|---|
| deleted_at | timestamp, nullable | Set when the comment author or idea owner deletes it. A deleted comment with replies shows as "Comment deleted"; one without replies is left out |

Sprint comments are one level deep: a reply to a reply is stored under the same top-level comment. Index on (idea_id, parent_comment_id, created_at). A student can post at most 20 comments in 10 minutes. Shares are `interactions` rows of kind `share`, at most one per student per idea per 30 minutes; the share count is public.
## Marketplace Phase 1 (added 2026-11-15)

Decisions are in MEMORY.md ("Marketplace Phase 1 decision"). Attest never holds money: these tables only record deals, milestones and off-platform payments. Amounts are integer minor units (paise, cents) with an ISO 4217 `currency`.

### users (added columns)
| Column | Type | Notes |
|---|---|---|
| username | text, unique (existing) | Now the public **handle**. New accounts get a random handle; `^[a-z0-9_]{3,24}$`; renameable while unique |
| branch | text, nullable (existing) | Now free text up to 40 chars (discipline). The six Amrita codes stay as suggestions |
| semester | int, nullable (existing) | Range widened to 1–12 |
| country | text, nullable | ISO country name or code, free text up to 56 |
| city | text, nullable | Up to 80. Used later for hardware locality |
| show_institution | boolean, default false | When false, other users see "Verified student" instead of `university` |
| adult_confirmed_at | timestamp, nullable | Self-confirmation of 18+. Required for paid deal types |
| suspended_at | timestamp, nullable | Admin platform suspension. Suspended users can read and appeal but not write |
| suspended_reason | text, nullable | Required when suspended |
| suspension_appeal | text, nullable | User's appeal, up to 2000 chars |
| appealed_at | timestamp, nullable | |

### academic_verifications
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK users | |
| email_domain | text | Domain of the verified address |
| method | text | `otp` or `microsoft` |
| verified_at | timestamp | Refreshed on every sign-in |
| expires_at | timestamp | verified_at + 365 days |

Unique on (user_id, email_domain).

### ideas (added columns)
| Column | Type | Notes |
|---|---|---|
| deal_type | text, default `credit_only` | `paid_fixed`, `sponsor_stipend`, `open_source`, `co_owned`, `credit_only` |
| currency | text, nullable | Required for paid types. ISO 4217, e.g. INR, NPR, USD |
| budget_minor | int, nullable | Required (> 0) for paid types |
| licence | text, nullable | Required for `open_source` (e.g. MIT, Apache-2.0, CERN-OHL-S) |
| not_academic_attested_at | timestamp, nullable | Set when the poster confirms this is not graded coursework |
| integrity_checked_at | timestamp, nullable | Set by the integrity worker |

### problems (added columns)
| Column | Type | Notes |
|---|---|---|
| not_academic_attested_at | timestamp, nullable | As on ideas |
| integrity_checked_at | timestamp, nullable | As on ideas |

### engagements
One deal between an idea owner (requester) and one active team member (builder).
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| idea_id | uuid, FK ideas | |
| requester_id | uuid, FK users | Idea owner |
| builder_id | uuid, FK users | Must be an active team member, never the requester |
| deal_type | text | Same enum as ideas |
| currency | text, nullable | Required for paid types |
| total_amount_minor | int, default 0 | Sum of milestone amounts |
| licence | text, nullable | Required for open_source |
| ip_terms | text | Default: IP moves to the requester milestone by milestone, on confirmed payment; builder keeps portfolio rights |
| nda | boolean, default false | |
| not_academic_attested_at | timestamp | Required |
| status | text, default `proposed` | `proposed`, `active`, `completed`, `cancelled` |
| builder_accepted_at, completed_at, cancelled_at | timestamp, nullable | |
| cancel_reason | text, nullable | |
| created_at | timestamp | |

Index on (builder_id, status) and (requester_id, status). A builder can hold at most 2 `active` paid engagements.

### milestones
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| engagement_id | uuid, FK engagements | |
| position | int | 1-based order |
| title | text | 3–140 chars |
| amount_minor | int, default 0 | 0 for unpaid deals |
| due_at | timestamp, nullable | |
| status | text, default `open` | `open`, `submitted`, `accepted`, `auto_accepted`, `disputed`, `payment_confirmed` |
| deliverable_links | jsonb string array | 1–6 links on submit |
| note | text, nullable | Builder's submit note |
| submitted_at, acceptance_deadline, accepted_at, disputed_at | timestamp, nullable | Deadline = submitted_at + 7 days; the worker auto-accepts after it |
| dispute_reason | text, nullable | |
| created_at | timestamp | |

At most 8 milestones per engagement.

### payment_confirmations
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| milestone_id | uuid, FK milestones, unique | |
| method | text | `upi`, `bank_transfer`, `razorpay_link`, `payoneer`, `wise`, `paypal`, `cash`, `other` |
| external_reference | text, nullable | Receipt or transaction ID only, ≤ 80 chars. Never an account, card or UPI number |
| payer_confirmed_at | timestamp, nullable | Requester says they paid |
| payee_confirmed_at | timestamp, nullable | Builder says they received it; sets the milestone to `payment_confirmed` |
| created_at | timestamp | |

### reviews
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| engagement_id | uuid, FK engagements | Must be `completed` |
| reviewer_id, reviewee_id | uuid, FK users | The two parties |
| on_time, communication, quality | int | 1–5 |
| would_work_again | boolean | |
| note | text, nullable | ≤ 500 chars, shown with the review |
| created_at | timestamp | |

Unique on (engagement_id, reviewer_id). A review is visible only when both parties have reviewed or 14 days have passed since `completed_at`. Profiles show counts per score, never an average.

### engagement_messages
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| engagement_id | uuid, FK engagements | Only the two parties read or write |
| user_id | uuid, FK users | |
| body | text | 1–2000 chars |
| flag | text, nullable | `contact_details` when a payment handle, phone number or email is detected |
| created_at | timestamp | |

Index on (engagement_id, created_at). Cursor-paginated. Read-only once the engagement is completed or cancelled.

### integrity_flags
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| target_type | text | `idea`, `problem`, `engagement` |
| target_id | uuid | |
| source | text | `keyword` or `model` |
| label | text | e.g. `graded_coursework` |
| score | numeric(5,4), nullable | Model similarity |
| matched | text, nullable | The phrase that matched, ≤ 200 chars |
| status | text, default `pending` | `pending`, `cleared`, `confirmed` |
| reviewer_id | uuid, FK users, nullable | |
| reviewed_at | timestamp, nullable | |
| created_at | timestamp | |

Index on (status, created_at). A confirmed flag hides the post (`hidden_at`); it never suspends automatically.

## Campus layer and gigs (added 2026-11-15)

Decisions are in MEMORY.md ("Campus layer, gigs and visual identity decision"). Campus means the same verified email domain.

### users (added column)
| Column | Type | Notes |
|---|---|---|
| email_domain | text, nullable | Lowercase domain of `email`, set at sign-in and backfilled. Indexed. Drives every campus filter |

### ideas (added columns)
| Column | Type | Notes |
|---|---|---|
| campus_domain | text, nullable | Owner's `email_domain` when posted |
| campus_only | boolean, default false | When true, only viewers on `campus_domain` (and the owner) can see it anywhere |

### problems (added column)
| Column | Type | Notes |
|---|---|---|
| campus_domain | text, nullable | Author's `email_domain` when posted. Used by the My campus filter |

### gigs
Quick freelancing posts. Shown by handle only.
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| author_id | uuid, FK users | |
| kind | text | `request` (author needs work done; author is the requester) or `offer` (author sells a service; author is the builder) |
| title | text | 6–100 chars |
| description | text | 30–1500 chars |
| category | text | One of `GIG_CATEGORIES` in `packages/types/campus.ts` |
| deal_type | text | `paid_fixed` or `credit_only` |
| currency | text, nullable | Required when paid |
| price_minor | int, nullable | Required (> 0) when paid. Fixed price of the single milestone |
| delivery_days | int, nullable | 1–60, optional |
| campus_domain | text, nullable | Author's `email_domain` |
| campus_only | boolean, default false | As on ideas |
| status | text, default `open` | `open` or `closed`. A request closes when someone is hired; an offer stays open |
| not_academic_attested_at | timestamp | Required |
| hidden_at | timestamp, nullable | Set when an admin confirms a coursework flag |
| created_at | timestamp | |

Index on (status, kind, created_at). At most 5 open gigs per author.

### gig_responses
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| gig_id | uuid, FK gigs | |
| user_id | uuid, FK users | Never the gig author |
| note | text | 12–1000 chars. Only the gig author and the responder can read it |
| status | text, default `new` | `new`, `hired`, `declined` |
| engagement_id | uuid, FK engagements, nullable | Set when hired |
| created_at | timestamp | |

Unique on (gig_id, user_id). Accepting a response creates an `active` engagement with one milestone (title = gig title, amount = gig price).

### engagements (changed)
| Column | Type | Notes |
|---|---|---|
| idea_id | uuid, FK ideas, **nullable** | Null for gig deals |
| gig_id | uuid, FK gigs, nullable | Set for gig deals. Exactly one of idea_id / gig_id is set |

### integrity_flags (changed)
`target_type` may also be `gig`. Confirming hides the gig.

## Demand signal and team thread (added 2026-11-15)

### reactions (changed)
`target_type` may also be `want` ("I'd use this"), with `target_id` = `ideas.id`. Same unique rule. The idea owner cannot add one. Counts are public; who clicked is not listed. The per-campus count joins `users.email_domain`.

### group_messages (reused)
The team thread for an idea uses the idea's `groups` row (created with the idea) and `group_messages`. Access is checked against the campus team (`ideas.owner_id` or an active `team_members` row), not `group_members`. `image_url` stays null. Cursor-paginated, 30 per page.

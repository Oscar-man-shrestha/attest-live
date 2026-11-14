# Attest: campus product and launch plan

Research and planning snapshot: 18 October 2026. This plan is a proposal for the existing Amrita Bengaluru sprint product. It does not change the approved stack or turn deferred features into commitments.

## The objective

**Help a student turn a real problem or an unfinished idea into a small, credible outcome with people they would not otherwise meet.** The shortest useful loop is: discover a relevant need → offer a specific contribution → form a team → complete a two-week build → have the work witnessed → show the result. A feed, likes, and profiles are useful only when they advance that loop.

The first market is verified Amrita Bengaluru students. A student may act as a problem reporter, a project owner, a collaborator, or all three. The product uses **two kinds of posts**, not permanent classes of people:

- **Problem:** “The canteen queue is slow and students cannot see order status.” The reporter describes who is affected, how often, and what a better outcome would be. They do not need to know how to build it. A builder can propose a project in response.
- **Idea:** “I want to prototype advance canteen ordering for one counter.” The owner gives enough public context for teammates to judge fit, states the skills and hours needed, and chooses how much of the implementation approach to reveal. A collaborator applies with a concrete plan.

The desired outcome for a canteen example is a tested ordering prototype or a documented finding that the canteen cannot support it yet. Integrating with student IDs or campus payment systems requires institutional approval and must never be implied to exist because a student posted the idea.

## Why students would use it

1. **Owners:** reach capable classmates beyond their friend group, get useful feedback, and finish a small build.
2. **Collaborators:** find a role that matches their skill and available time, learn with a team, and receive a signed work receipt instead of an empty “team member” claim.
3. **Problem reporters:** make a campus pain visible, clarify it with others, see whether a builder takes it on, and receive credit as the source when a related build ships.
4. **Students with no idea yet:** browse verified needs and open roles; their first act can be a helpful comment, user interview, design sketch, or test, not a full project proposal.

The product promise is **“find your people, build something useful, prove what you did.”** It should not promise idea ownership, jobs, faculty endorsement, or guaranteed implementation.

## Comparable products: patterns to borrow

| Product | Proven interaction | Lesson for Attest | Gap for this job |
| --- | --- | --- | --- |
| [YC Co-Founder Matching](https://www.ycombinator.com/cofounder-matching) | Profiles, preference based discovery, mutual invitation; people may arrive without an idea | Let capability and intent drive matching; invitation should require acceptance | Startup co-founder search is a much larger commitment than a campus sprint |
| [Devpost team formation](https://help.devpost.com/article/75-participants-page-forming-a-team) | “Looking for teammates,” introduction, request, leader confirms membership | Show role availability and make joining an explicit two-sided decision | Usually bound to an event; limited path from campus problem to sustained proof |
| [GitHub Discussions](https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/about-discussions) + [good first issue](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/encouraging-helpful-contributions-to-your-project-with-labels) | Open discussion becomes a scoped task; approachable tasks are labeled | Allow public brainstorming, then give newcomers a small first contribution | Assumes a repository and a maintainer already exist |
| [Reddit](https://redditinc.com/news/keeping-our-platform-safe) | Topic communities, public discussion, voting, and layered moderation | Use replies and reporting to refine ideas while keeping work proof separate from popularity | Conversation and votes do not form accountable teams or finish builds |
| [IdeaScale](https://ideascale.com/product-tour/idea-collection/) | Structured idea submission, similarity search, comments, voting, optional privacy | Use structured prompts and similar-post hints to improve idea quality | Voting can reward popularity without getting a team to build |
| [LinkedIn Projects](https://www.linkedin.com/help/linkedin/answer/a8064614) | Project, skills, media, and collaborators appear on a profile | Make shipped work portable and legible | A project claim alone does not verify who did what |

These are product descriptions, not proof that their designs improve Attest outcomes. The campus pilot must test the assumptions below.

## The idea protection problem

There is no truthful “nobody can steal your idea” guarantee. India's Copyright Office says copyright protects expression, not an idea or concept. Public disclosure can also matter to patent novelty; someone with a potentially patentable invention should get qualified advice **before** revealing enabling details publicly. [India Copyright Office](https://copyright.gov.in/documents/handbook.html) · [IP India patent basics](https://ipindia.gov.in/pages/patents/learn/basics-of-patents)

Attest should offer **control, attribution, and evidence**, with plain language about their limits:

1. **Useful public teaser:** problem, affected user, intended outcome, current stage, skills needed, time commitment, and what the team will deliver. This is enough for someone to decide whether to apply.
2. **Owner chosen visibility:** `minimal`, `standard`, or `open`, as already implemented. Private approach, detailed design, source files, and sensitive research remain outside the teaser unless the owner chooses to share them. The API must enforce field access, not just blur text in the browser.
3. **Structured application:** a candidate explains relevant skill, available hours, and a first contribution. After owner acceptance, the candidate can see the permitted brief and workspace. Access is a trust decision, not a secrecy guarantee; members can still copy what they see.
4. **Provenance:** keep author, creation time, related problem, public fork ancestry, and signed task receipts. Display “posted by” and “built with” accurately. A timestamp records what was posted; it does not establish exclusive legal rights or originality.
5. **Safe remix:** existing fork behavior copies only the public slice and credits the source. A similar independent solution is not automatically theft. Provide a report route for copied text, impersonation, or abusive behavior, with human review.
6. **Publication guidance:** say “Share the outcome and who needs help; keep any secret implementation detail out of the public post.” For a truly confidential or potentially patentable invention, advise the student to avoid publishing the crucial detail on Attest until they have appropriate advice.

Example teaser: “Students wait 15–25 minutes at lunch. We are testing a pickup slot prototype with one canteen counter. Need one UI designer and one student who can interview canteen staff, about 3 hours/week for two weeks. First deliverable: clickable flow and five user interviews.” The owner may keep payment integration choices, code, and campus contacts private. The time estimate is illustrative, not a measured campus fact.

## Core product journey

1. **Arrive:** landing page shows one authentic Idea and one authentic Problem, what happens in 14 days, and a visible explanation of campus sign-in and idea visibility. No invented activity counts.
2. **Identify:** profile asks what the student can do, what they want to learn, available hours, and one proof link or example. Skipping proof is allowed; a new student must still be able to contribute.
3. **Find:** separate Ideas and Problems boards. Each card answers “what is the need?”, “who is needed?”, “what is the next step?”, and “why am I seeing this?” Filters prioritize role, time, and stage over vanity metrics.
4. **Respond:** public comments help refine scope; “Ask to join” sends a specific offer; “Propose an idea” links a build to a Problem. Owners respond promptly with accept, tryout, or decline.
5. **Build:** a two-week workspace has a first task, owner, due date, blocker check-in, and links to work. Start small enough to complete. A build may end with a prototype, field test, research report, or honest failed test.
6. **Attest:** a teammate signs submitted work. Signed receipts appear on an opt-in proof page. Likes never become skill verification. The problem reporter gets source attribution when a shipped build links back to their problem; that attribution is distinct from a signed build contribution.

## Why the experience may motivate participation

Self-determination research identifies autonomy, competence, and relatedness as important for motivation. Attest should give students control over disclosure and commitment, approachable ways to show progress, and actual teammate relationships. This is a design hypothesis, not a claim that these specific screens have been experimentally validated. [Ryan and Deci](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf)

Research on team psychological safety associates it with learning behavior. Product implications: normalize “I am stuck,” let beginners ask questions without public ranking penalties, and make scope and responsibilities clear. A newer field study found that nicer first replies increased positive interaction but did not by itself improve later contribution quality, so Attest must measure completed work rather than celebrate comments alone. [Edmondson](https://dash.harvard.edu/entities/publication/13a7b031-0fdd-45ec-a7e0-2b80e2bc679f) · [Pethig et al.](https://aisel.aisnet.org/misq/vol49/iss2/16/)

Practical rules: show meaningful roles beyond coding; make the first contribution small; give a human response within a day or two; highlight shipped artifacts and signed contributions; show failures as lessons; avoid pressure loops, fake urgency, follower races, and rewards for raw post volume.

## Main risks and responses

- **Empty board / network cold start:** recruit both problem reporters and available builders before a broad launch. Curate genuine posts with permission; never fabricate users, builds, or reactions.
- **Vague ideas:** creation form asks for user, pain, two-week outcome, skills, hours, and first task; let owners save a draft. Suggest similar posts before publication.
- **No reply to an offer:** owner inbox makes response status visible; set an expectation of a 48-hour response and let applicants withdraw or try another team.
- **Free riders / credit disputes:** scope tasks per person, freeze submitted evidence before a teammate signs, show pending versus signed clearly, and route disputes to human review. A signature is testimony from a teammate, not platform verification of quality.
- **Popularity bias:** do not rank only by likes. Give new and cross-branch posts exposure; measure whether less connected students receive offers. Show reasons for recommendations.
- **Idea copying or sensitive disclosure:** visibility controls, private brief, minimal public slice, clear warning at publish time, source attribution, and report review. No promise of legal exclusivity.
- **Problem spam and impossible campus integrations:** ask for firsthand evidence and feasibility; label institutional dependencies; encourage a low-risk prototype or research deliverable.
- **Harassment and favoritism:** campus verification, bounded application and comment rates, reports, admin review, and explicit anti-abuse rules. Do not expose private profile fields or CGPA on public pages.
- **Teams fade after excitement:** first task immediately after acceptance, day-7 check-in, blocker visibility, and a small ship target.

## Campus launch and marketing experiment

The first launch should be a **managed cohort**, not an empty public marketplace. Recruit a balanced mix of students across branches and years, including designers, researchers, organizers, and builders. Ask a few legitimate campus stakeholders to submit Problems through eligible student reporters; current product rules do not support faculty accounts or endorsements. Get consent before featuring anyone's post.

**Weeks 0–1: discovery.** Interview 10–15 students across branches plus a few canteen, club, or lab stakeholders. Ask for the last time they sought a teammate, an idea, or help, what they actually did, and why it failed. Collect real campus pains and willingness to spend two weeks. These counts are research targets, not findings.

**Week 2: seed supply.** Invite roughly 20–30 students with complementary skills and publish 10–15 real posts, aiming for a mix of Problems and Ideas. Have each owner define an achievable first task. Personally match the first few offers where useful, while recording which matches needed manual help.

**Weeks 3–4: two-week sprint.** Launch through small class and club sessions, lab groups, and student ambassadors who have actually posted or joined. Show a real problem and the first task rather than generic “join our platform” promotion. One short weekly digest can point to unsolved needs and open roles, consistent with the existing no-push policy and appropriate consent.

**Weeks 5–6: show outcomes.** Hold a demo or campus showcase with honest artifacts, reporter credit, contributor receipts, and lessons learned. Ask participants to invite one person with a missing skill for the next cohort. Publish the story of one useful build only with team consent; no false success claims.

**Positioning by channel:** clubs get a way to recruit for concrete roles; placement-minded students get evidenced contributions; builders get validated problems; nontechnical students get a way to shape products. The landing copy should lead with the job each group cares about, not “Reddit + GitHub + LinkedIn.”

## Pilot scorecard and decision rules

The north-star measure is **teams that produce a reviewable outcome with at least one signed contribution per 14-day cohort**. This avoids optimizing for signups and likes. Track the whole funnel by branch, semester, and role so one well-connected group does not mask weak access for others.

| Stage | Measure | Initial pilot target / interpretation |
| --- | --- | --- |
| Activation | Verified students who complete a useful profile and take one meaningful action within 7 days | Baseline first; aim for ≥50%. A meaningful action is a problem, idea, useful comment, or structured offer |
| Match | Open ideas with at least one qualified offer in 48 hours | Aim for ≥60%; inspect roles and clarity when lower |
| Response | Offers receiving owner decision within 48 hours | Aim for ≥80%; owner silence is a product failure |
| Work | Accepted teams with a first task started within 72 hours | Aim for ≥70%; otherwise joining is too ceremonial |
| Completion | Accepted teams with a reviewable artifact at day 14 | Aim for ≥40% in first cohort, then improve; include documented learning from failed tests |
| Proof | Shipped teams with at least one signed receipt | Aim for ≥70%; audit whether signatures represent specific work |
| Fairness | Offer and acceptance rates by branch, gender if voluntarily and safely measured, year, and prior connection | Investigate large gaps; do not rank people by protected traits |

These thresholds are **hypotheses for a small pilot**, not industry benchmarks. Report numerator, denominator, cohort dates, and confidence limits where sample size permits. Pair event data with interviews; an apparent conversion gain can hide low-quality work.

## Build order from the current repository

The repository already has campus sign-in, separate boards, visibility modes, structured offers, people discovery, workspaces, day-7 checks, reports, and signed proof. Do not rebuild them. First verify the full journey with real student testers and fix the highest-friction transitions. In order:

1. Complete deployment readiness in `DEPLOY.md`, especially secret rotation, probe cleanup, production health, and privacy checks.
2. Run five end-to-end student sessions: Problem → proposed Idea, Idea → offer → accept, acceptance → first task, task → signature, and a nonmember checking that private fields are hidden. Fix observed blockers.
3. Improve copy and forms only where sessions show confusion: especially the difference between Problem and Idea, visibility choices, expected response time, and what a signed receipt means.
4. Add only the analytics needed for the pilot scorecard, using existing services and privacy rules. Obtain campus approval for any research data collection that requires it.
5. Launch one managed two-week cohort, review outcomes, then revise the next backlog. Defer global expansion until multiple campus cohorts show repeatable team formation and completion.

Global expansion should be a later product decision: university verification, language, moderation capacity, and local relevance change substantially. The first defensible advantage is not a novel algorithm; it is a trusted local network that repeatedly turns needs into completed work with fair credit.

## What remains uncertain

- Whether enough students will commit time rather than merely browse. Test through first-task start and day-14 artifacts.
- Whether owners will share enough public detail to attract strong offers while keeping private details private. Test teaser comprehension with candidates and disclosure comfort with owners.
- Whether problem reporters want public identity and how source credit should appear on shipped builds. Interview them before changing schema or credit rules.
- Whether faculty and staff should ever post directly. Current PRD explicitly excludes faculty login, so the first cohort uses student reporters and records demand for a later decision.
- Whether a 14-day sprint fits projects outside software. Keep the deliverable flexible and test it across branches before expanding scope.

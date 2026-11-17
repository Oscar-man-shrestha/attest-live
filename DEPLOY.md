# DEPLOY.md — Launch checklist for Attest

Work top to bottom. Boxes marked **(you)** need the founder: they involve accounts, secrets or legal sign-off that an agent must not do alone.

## Status on the founder's machine (2026-11-17)
- Google sign-in: **done for local use.** Google Cloud project `attest-515009`, OAuth client "Attest web", redirect `http://localhost:3001/login/google/callback`, keys in `api/.env`. The app is in Google's **Testing** mode: only test users can sign in (cap 100). To open it to everyone, deploy to a real domain, fill in Branding (home page, `/privacy`, `/rules`, authorized domain), add the production redirect URI, then Audience → Publish app.
- Admin: `pixel_97135` (founder's Outlook account).
- Contact email: set in `web/.env.local` (`NEXT_PUBLIC_SUPPORT_EMAIL`).
- Test data: kept on purpose (7 seed/test accounts).
- Workspaces and plans: built. Billing is manual (see section 7a). Prices are placeholders in `PLANS`, `packages/types/campus.ts`.
- Still open: Resend sending domain (needs a domain you own), lawyer review, CA advice on invoicing and GST, first real Kit, first paying workspace.

## 1. Sign-in (nobody can join until one of these works)
The sign-in page only shows methods that are set up (`GET /api/v1/auth/campus/methods`).

- [ ] **(you) Email codes.** In Resend, verify a domain you own, then set in `api/.env`:
  `RESEND_API_KEY=…` and `RESEND_FROM=Attest <login@your-domain.com>`. The free `resend.dev` sender is rejected on purpose: it only delivers to your own inbox.
- [ ] **(you) Google.** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → *Web application*.
  Authorized redirect URI: `<web origin>/login/google/callback`. Put the values in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
  Anyone with a verified Google email can sign in; a university email additionally marks them as a verified student. Set the OAuth consent screen to *External* and publish it, or only test users can sign in.
- [ ] **(you) Amrita Outlook (optional).** Rotate the Microsoft client secret in Entra (the old value was pasted in a chat) and update `MICROSOFT_CLIENT_SECRET`. The redirect URI registered in Entra must equal `MICROSOFT_REDIRECT_URI` exactly, including the port.

## 2. Secrets and config
- [ ] `JWT_SECRET`: a random string of 32+ characters (`openssl rand -hex 32`). **Production refuses to start without it.** Changing it signs everyone out.
- [ ] `DATABASE_URL` points at the production Supabase project.
- [ ] `WEB_ORIGIN` on the API = the exact public web origin (no trailing slash). It is also used to build the Google redirect URI.
- [ ] `NEXT_PUBLIC_API_URL` on the web = the public API base (`https://…/api/v1`).
- [ ] `NLP_URL` on the API = the NLP service (an internal URL is fine).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_…` key), or image uploads fail.
- [ ] Leave `ATTEST_TEST_LOGIN_*` unset in production (it is ignored there anyway).
- [ ] Leave `GEMINI_API_KEY` / `GROK_API_KEY` unset: drafting stays off by design.
- [ ] Start from `api/.env.example`, `web/.env.example`, `packages/db/.env.example`.

## 3. Database
Migrations live in `packages/db/migrations`. The app's database role cannot change tables, so run new migration files in the Supabase SQL editor (as `postgres`), in order. Already applied to the `attest` project: `0000`–`0012` (`0012` adds workspaces and subscriptions).

On a fresh Supabase project, also create the `attest_app` role and grant it table access, then run every migration. New tables must have RLS on and no `anon` / `authenticated` grants (see the end of `0007` and `0008`).

Free Supabase projects pause after a week without use, and only two free projects can be active per account. Pausing breaks the app until someone resumes the project in the dashboard.

## 4. Data hygiene before real students
- [ ] **(you)** Decide whether to keep the seed accounts and test ideas. To remove probe rows only:
```bash
cd packages/db
npx ts-node --transpile-only seed-campus.ts --wipe-probes
```
- [ ] **(you)** Make yourself an admin so you can see Reports, coursework flags and appeals: in the Supabase SQL editor, `update users set is_admin = true where email = '<your sign-in email>';`

## 5. Run it (three processes)
| Service | Dir | Command | Port | Health |
| --- | --- | --- | --- | --- |
| Web | `web/` | `npm run build && npm start` | 3001 | `/` shows the landing page |
| API | `api/` | `npm start` (production) or `npm run dev` | 5001 | `GET /api/v1/health` → `{ status, nlp, workers }` |
| NLP | `nlp/` | `.venv/bin/uvicorn main:app --port 8001` | 8001 | `GET /health` |

`npm start` in `api/` runs TypeScript directly with `ts-node` in production mode. `npm run typecheck` checks types.
Put web and API behind HTTPS. Load balancers can probe `/api/v1/health` (always HTTP 200; `status` is `degraded` when NLP is down, and the feed falls back to keyword matching).

## 6. Smoke test (two student accounts, ideally on two different university domains)
1. Logged-out `/` shows the landing page; `/rules` opens without signing in.
2. Sign in by each method you set up, with a university email and with a personal one. Only the university one shows "verified student". Five wrong email codes lock that code.
3. Finish the profile → `/ideas`. Flip **My campus / Everywhere**.
4. Post an idea as "Only my campus": the other university can't see it in the list or by link.
5. Like, "I'd use this", comment, save and remix a card.
6. Ask to join → accept → the team workspace opens; send a message in the **Team thread**.
7. Owner proposes a paid deal → builder accepts → submit → accept → owner records payment → builder confirms → both review. The profile shows the stamped record.
8. Post a gig, respond from the other account, accept: a one-milestone deal starts.
9. Post something that reads like homework: it appears under Reports → Coursework flags for an admin.
10. Suspend and un-suspend a test account as admin; the suspended account can still read and appeal.
11. Check a hidden-name idea as an unrelated student: no owner name or id is shown.
12. Open the site on a phone: the bottom bar shows six tabs and nothing scrolls sideways.
13. Create a workspace, add a teammate by handle, start a Kit from it, then **Request Pro**. As admin, Reports → Billing → **Payment received — activate**. The Kit now shows "Verified organiser" and **Export CSV** downloads.

## 7. Before you take real money or real users **(you)**
- [ ] A lawyer reviews: the house rules (`/rules`), the default ownership (IP) terms in deals, Terms of Use and a Privacy Policy (neither exists yet), and whether India's DPDP Act or other privacy laws apply to you.
- [ ] A CA confirms Attest has no TDS / GST duties on deals between students, since it never touches that money.
- [ ] A CA advises on workspace plan revenue: this money **is** yours, so you need proper invoices, and GST registration once you cross the threshold or sell across borders.
- [ ] Decide how people contact you (support email) and add it to `/rules` and `/help`.
- [ ] Collect your first 30 real projects by hand before inviting builders (see the research report).

## 7a. Taking payment for workspace plans **(you)**
Attest has no card checkout. The flow is manual and needs no payment keys:
1. A workspace owner clicks **Request Pro** (or **Ask about Campus**). Admins get a notice.
2. In **Reports → Billing** you see the workspace, the owner's email and the list price.
3. Email them, send an invoice, and take payment by UPI or bank transfer to your own account.
4. When the money arrives, pick the number of months and click **Payment received — activate**. **Extend** adds months; **End plan** stops it. Plans lapse to Free on their own when the period ends.

To add card checkout later (e.g. Razorpay), you need a payment-gateway account in your own name (KYC), a public website with Terms, Privacy and a refund policy, and a webhook that calls the same activation logic. Do not add it before the CA advice above.

## 8. What is already in place
- Any-university sign-in with yearly re-verification; university hidden by default; random handles.
- Suspended accounts are read-only; admin flags and appeals queue.
- Rate limits: email codes (1/min, 5/hour, 5 wrong tries), offers (8/hour), messages (10/min), idea posts (30 min apart).
- Security headers on the API; production refuses a weak `JWT_SECRET`.
- Attest never holds money between students: no payment keys exist anywhere in the code. Workspace plans are invoiced by hand.
- Sign-in secret is read in one place (`api/src/config/jwtSecret.ts`) at use time.

## 9. After go-live
- Watch Resend bounce and spam rates for login codes.
- Watch NLP disk use and API 429s.
- Check Reports → Coursework flags every day in the first weeks.
- Update `MEMORY.md` when a sticky decision changes.

# Development Log

## Week 4, Day 17 — 2026-08-09

### Tasks Completed
- [x] Task 79 — Fix two Week 3 known issues: OpenAI eager-init crash risk, rate-limit IPv6 warning

### Files Modified
- `server/src/lib/openai.js` — client is now built lazily on first `chat()` call via `getClient()`, instead of at import time; throws a clear `OPENAI_API_KEY is not set` error (caught by existing `next(err)` handlers in `aiController.js`, surfaces as a normal 500) rather than crashing the whole server on boot when the key is missing/empty
- `server/src/index.js` — `aiLimiter`'s `keyGenerator` now wraps the `req.ip` fallback in express-rate-limit's `ipKeyGenerator` helper (only used when there's no `Authorization` header), clearing the `ERR_ERL_KEY_GEN_IPV6` boot warning

### Tests Added
- None (manual verification: edited files, confirmed `node --watch` auto-restarted the server without crashing and `/api/health` still returned 200; `npm run lint` clean)

### Known Issues
- `redis.keys('analytics:<repoId>:*')` cache invalidation pattern — fine at current scale, not addressed.
- Repos connected before Task 71 still don't have a webhook registered retroactively.

### Next: Week 4, Task 80+
- TBD — options considered but deferred: date-range picker for analytics, extracting the now-3x-duplicated `MetricCard` component, CSV export for PR/commit tables

---

## Week 4, Day 17 (cont.) — Task 80 — 2026-08-09

### Tasks Completed
- [x] Task 80 — Extract shared `MetricCard`/`TrendBadge` component

### Files Created
- `client/src/components/MetricCard.jsx` — exports `MetricCard` and `TrendBadge`, extracted verbatim from the 3 identical copies in Dashboard/RepoDetail/ContributorDetail

### Files Modified
- `client/src/pages/DashboardPage.jsx`, `client/src/pages/RepoDetailPage.jsx`, `client/src/pages/ContributorDetailPage.jsx` — removed local `MetricCard`/`TrendBadge` definitions, import from `components/MetricCard.jsx` instead

### Tests Added
- None (manual: `npm run lint` shows fewer errors than before — 37 → 21 across the touched files, since prop-types debt on the shared component no longer triples up; verified end-to-end in-browser via claude-in-chrome — Dashboard, Repo Detail, and Contributor Detail all render trend badges correctly after the refactor. Also had to start Docker Desktop / `docker compose up -d`, which wasn't running at session start — Postgres/Redis containers weren't up.)

### Known Issues
- Same two carried over (`redis.keys()` cache invalidation pattern, retroactive webhook registration) — not in scope for this task.
- Repositories page shows "Never synced" for both seeded repos despite having PR/commit data — seed script inserts data directly without setting `repo.lastSyncAt`. Pre-existing, not introduced by this task.

### Next: Week 4, Task 81+
- Remaining deferred options: date-range picker for analytics, CSV export for PR/commit tables

---

## Week 4, Day 17 (cont.) — Task 81 — 2026-08-09

### Tasks Completed
- [x] Task 81 — CSV export for PR/commit tables

### Files Modified
- `client/src/components/RepoTables.jsx` — added `toCsv`/`downloadCsv` helpers; `PrTable` and `CommitTable` each gained a "↓ CSV" button in the table toolbar next to search. On click, re-fetches the current filter/search state (state filter, author, query) with `limit=100` (the server-side cap) rather than exporting just the loaded page, converts to CSV client-side, and triggers a browser download — same blob/anchor-click pattern as the existing JSON analytics export on `RepoDetailPage.jsx`. PR columns: #, Title, Author (if shown), State, Additions, Deletions, Created. Commit columns: SHA (short), Message (first line), Author (if shown), Additions, Deletions, Date.
- `client/src/pages/RepoDetailPage.css` — new `.table-toolbar-search` flex wrapper so the search input and CSV button group together on the right of `PrTable`'s toolbar (which also has the state-filter tabs on the left); reuses the existing `.export-btn` style from the JSON export button.

### Tests Added
- None (manual: lint error count on `RepoTables.jsx` unchanged before/after — 26/26, confirming no new prop-types/effect debt introduced; verified in-browser via claude-in-chrome that the button renders correctly on both PR and Commit tables and the export fetch (`GET /analytics/:id/prs?page=1&limit=100`) returns 200. Could not confirm the resulting file lands in `~/Downloads` from the automated browser session — tested the pre-existing JSON export button the same way and it also doesn't produce a file there, confirming this is a sandboxing limitation of the automated browser profile, not a regression; the download call itself uses the identical, already-shipped blob/anchor pattern.)

### Known Issues
- Export is capped at 100 rows (the server's hard `limit` cap on `/prs` and `/commits`) — fine at this app's scale, would need pagination-aware export for larger repos.
- Same two carried over from earlier in the day (`redis.keys()` cache invalidation, retroactive webhook registration) — not in scope.

### Week 4 Day 17 Summary
Tasks 79, 80, 81 done: fixed both outstanding known issues (OpenAI eager-init crash risk, rate-limit IPv6 warning), extracted the shared `MetricCard`/`TrendBadge` component out of 3 duplicated copies, and added CSV export to the PR/commit tables. Also had to start Docker Desktop mid-session (Postgres/Redis weren't running).

### Next: Week 4, Task 82+
- Remaining deferred option: date-range picker for analytics (currently fixed 7d/30d/90d presets, no custom range)

---

## Week 4, Day 16 — 2026-08-07

### Tasks Completed
- [x] Task 76 — Period-over-period trend deltas on Dashboard and Repo Detail metric cards
- [x] Task 77 — Text search on PR/commit tables
- [x] Task 78 — Extended trend badges to Contributor Detail page

### Files Created
- None (all changes extended existing files)

### Files Modified
- `server/src/services/analyticsService.js` — `getPeriodComparison(repositoryId, days, authorLogin?)`: one query per entity (PRs, commits) spanning 2×`days`, split in JS into current/previous windows; returns `{current, previous, deltaPct}` per metric (`prCount`, `mergedCount`, `avgTimeToMergeHours`, `commitCount`); `deltaPct` is `null` with no prior-period baseline
- `server/src/controllers/analyticsController.js` — `getRepoAnalytics` and `getContributor` both add a `trends` key to their response (same cache key/TTL as the rest of the payload); PR/commit list endpoints accept `?q=` for text search
- `client/src/pages/DashboardPage.jsx`, `client/src/pages/RepoDetailPage.jsx`, `client/src/pages/ContributorDetailPage.jsx` — `MetricCard` gained `trend`/`trendInvert` props rendering a colored ▲/▼ badge (green=good/red=bad; `trendInvert` flips polarity for metrics where lower is better, e.g. avg time to merge). Still three separate near-identical copies of this component, not extracted — matches existing per-page duplication pattern.
- `client/src/components/RepoTables.jsx` — debounced (350ms) search input in a new `.table-toolbar` row on `PrTable`/`CommitTable`, shared with the existing PR state filter tabs; empty-state message reflects the active query

### Tests Added
- None (manual/in-browser verification via claude-in-chrome: trend badges checked on Dashboard, Repo Detail, and Contributor Detail pages against the seeded testuser/frontend-app repo; search verified by querying "feature 3" on PRs and "commit 5" on commits, both correctly narrowing to the single matching row)

### Known Issues
- Same four carried over from Day 15 (OpenAI client eager-init crash risk, `ERR_ERL_KEY_GEN_IPV6` warning, `redis.keys()` cache invalidation pattern, pre-Task-71 repos missing webhooks) — none addressed today.
- Sitewide prop-types lint debt (from Task 73) now also covers the new `trend`/`trendInvert` props — left as-is, consistent with that prior decision.

### Next: Week 4, Task 79+
- TBD — pick based on what's actually built vs. the "UX polish + advanced analytics" week goal

---

## Week 3, Day 15 — 2026-08-06

### Tasks Completed
- [x] Task 71 — Webhook support: GitHub push events trigger auto-sync
- [x] Task 72 — Contributor detail view (click a contributor to see their PRs/commits)
- [x] Task 73 — Week 3 review + polish
- [x] Task 74 — Redis caching layer for analytics queries
- [x] Task 75 — Week 3 documentation + roadmap update

### Files Created
- `server/src/controllers/webhookController.js` — HMAC-verified GitHub webhook receiver
- `server/src/routes/webhooks.js`
- `server/src/lib/redis.js`, `server/src/lib/cache.js` — ioredis client + get/set/invalidate helpers
- `client/src/components/RepoTables.jsx` — shared PrTable/CommitTable/Pagination/PrStatusBadge, extracted from RepoDetailPage so ContributorDetailPage can reuse them
- `client/src/pages/ContributorDetailPage.jsx` — per-contributor summary + filtered PR/commit tables, route `/repos/:id/contributors/:login`

### Files Modified
- `server/prisma/schema.prisma` — added `Repository.webhookId`
- `server/src/services/githubApiService.js` — `createRepoWebhook` / `deleteRepoWebhook`
- `server/src/controllers/repoController.js` — registers a push webhook on connect, removes it on disconnect (best-effort; doesn't block the request if GitHub rejects it, e.g. no admin access)
- `server/src/controllers/analyticsController.js` — `author` filter on PR/commit lists, new `getContributor` endpoint, Redis caching (120s TTL) on the two aggregation endpoints (`getRepoAnalytics`, `getContributor`)
- `server/src/services/analyticsService.js` — `getContributorSummary`
- `server/src/workers/syncWorker.js` — invalidates a repo's analytics cache after a successful sync
- `server/src/routes/analytics.js` — new contributor route + `author` query validation
- `server/src/index.js` — raw-body parsing for the webhook route ahead of the global JSON parser, mounted `/api/webhooks`
- `server/src/config/index.js`, `server/.env.example` — `GITHUB_WEBHOOK_SECRET`, `WEBHOOK_BASE_URL`
- `client/src/pages/RepoDetailPage.jsx` — now imports shared tables from `RepoTables.jsx`; Top Contributors rows link to the contributor page (also fixed a pre-existing duplicate/typo'd `PrStatebage` component while extracting)
- `client/src/pages/ReposPage.jsx` — "⚡ Auto-sync" badge on repo cards that have a registered webhook
- `client/src/App.jsx` — route for `ContributorDetailPage`

### Tests Added
- None (manual testing: signed/unsigned webhook payloads via curl against a running server; contributor flow clicked through in-browser via claude-in-chrome; cache hit/miss and invalidation verified directly against Redis)

### Known Issues
- `server/.env` had an empty `OPENAI_API_KEY` going into today, which crashes a fresh boot (`lib/openai.js` builds the client eagerly at import time) — fixed by the user adding a real key mid-session; worth making that lazy so a missing key doesn't take down the whole server.
- `aiLimiter`'s custom `keyGenerator` in `src/index.js` throws a non-fatal `ERR_ERL_KEY_GEN_IPV6` warning on boot — should switch to express-rate-limit's `ipKeyGenerator` helper.
- Cache invalidation uses `redis.keys('analytics:<repoId>:*')`, which is fine at this app's scale but wouldn't be the right pattern under a much larger keyspace.
- Repos connected before today won't have a webhook registered retroactively — only new connections register one.

### Week 3 Summary
All 25 tasks complete (Tasks 51–75). AI features, background job resilience, and security hardening:
- OpenAI (`gpt-4o-mini`) integration: PR summaries, weekly reports, repository health score, and a per-repo AI chat endpoint grounded in that repo's PR/commit data
- Sync worker notifications on completion/failure (`notificationService`, notification bell in the header)
- PR filtering by state, analytics export as JSON
- Onboarding empty state for first-time users
- Security: AI endpoint rate limiting (10 req/min per token)
- GitHub webhooks for auto-sync on push, so repos stay current without manual syncing
- Contributor drill-down view
- Redis-backed caching on the analytics aggregation endpoints

### Next: Week 4 — Webhooks, UX Polish, Advanced Analytics (Tasks 76–100)
- Task 76: TBD — see `docs/roadmap.md` for the week's focus areas

---

## Week 3, Day 14 — 2026-08-05

### Tasks Completed
- [x] Task 66 — AI endpoint rate limiting (10 req/min per token)
- [x] Task 67 — PR filter by state (All / Open / Merged / Closed)
- [x] Task 68 — Onboarding empty state with guided steps on Dashboard
- [x] Task 69 — Export analytics as JSON from repo detail page
- [x] Task 70 — Week 3 documentation update

---

## Week 2, Day 10 — 2026-07-30

### Tasks Completed
- [x] Task 46 — Security: helmet headers + express-rate-limit on auth routes
- [x] Task 47 — PR list table in repo detail page (paginated)
- [x] Task 48 — Commit list table in repo detail page (paginated)
- [x] Task 49 — GET /api/analytics/:id/prs + /commits endpoints with pagination
- [x] Task 50 — Week 2 documentation update

### Week 2 Summary
All 25 tasks complete (Tasks 26–50). Full GitHub sync pipeline + analytics layer built:
- GitHub API service with full pagination (@octokit/rest)
- Repo connect/list/disconnect with auto-sync on connect
- BullMQ + Redis background sync worker (PRs + commits)
- Analytics service: PR metrics, commit metrics, daily activity
- Dashboard with metric cards and commit chart
- Repo detail page with tabbed Overview / Pull Requests / Commits
- Settings page, Reports placeholder
- Security: helmet, rate limiting on auth routes

### Next: Week 3 — AI Features (Tasks 51–75)
- Task 51: OpenAI API integration
- Task 52: PR summary generation
- Task 53: Weekly report generation
- Task 54: Repository health score
- Task 55: AI chat endpoint

---

## Week 1, Day 5 — 2026-07-25

### Tasks Completed
- [x] Task 21 — GitHub OAuth backend (redirect + callback routes)
- [x] Task 22 — GitHub OAuth frontend (button + AuthCallbackPage)
- [x] Task 23 — User profile in header (completed in Day 4)
- [x] Task 24 — Input validation middleware (completed in Day 3)
- [x] Task 25 — Week 1 documentation

### Files Created
- `server/src/services/githubOAuthService.js`
- `client/src/pages/AuthCallbackPage.jsx`
- `docs/product-requirements.md` (completed)
- `docs/architecture.md` (completed)

### Files Modified
- `server/src/config/index.js` (added GitHub config)
- `server/src/controllers/authController.js` (added OAuth handlers)
- `server/src/routes/auth.js` (added OAuth routes)
- `client/src/pages/LoginPage.jsx` (added GitHub button)
- `client/src/pages/RegisterPage.jsx` (added GitHub button)
- `client/src/pages/AuthPages.css` (added GitHub button styles)
- `client/src/App.jsx` (added /auth/callback route)

### Tests Added
- None (manual browser testing of OAuth flow)

### Known Issues
- GitHub OAuth requires the server to be running publicly for production use
- Local dev OAuth works against localhost

### Week 1 Summary
All 25 tasks complete. Full-stack foundation built:
- Monorepo structure with Express + React
- PostgreSQL schema (5 tables) with Prisma migrations
- JWT auth (register, login, /me)
- GitHub OAuth
- Protected routes and app layout
- Docker Compose for local infrastructure

### Next: Week 2 — Core Features & Data Sync (Tasks 26–50)
- Task 26: GitHub API service
- Task 27: POST /api/repos
- Task 28: GET /api/repos
- Task 29: DELETE /api/repos/:id
- Task 30: Repository selection UI

---

## Week 1, Day 4 — 2026-07-24

### Tasks Completed
- [x] Task 16 — AuthContext + useAuth hook
- [x] Task 17 — Login page
- [x] Task 18 — Register page
- [x] Task 19 — Routing + ProtectedRoute
- [x] Task 20 — App layout shell (sidebar + header)

---

## Week 1, Day 3 — 2026-07-23

### Tasks Completed
- [x] Task 11 — POST /api/auth/register
- [x] Task 12 — POST /api/auth/login
- [x] Task 13 — requireAuth JWT middleware
- [x] Task 14 — GET /api/auth/me
- [x] Task 15 — Global error handler + Winston logger

---

## Week 1, Day 2 — 2026-07-22

### Tasks Completed
- [x] Task 6 — Prisma ORM initialization
- [x] Task 7 — Users table
- [x] Task 8 — Repositories + SyncJobs tables
- [x] Task 9 — PullRequests + Commits tables
- [x] Task 10 — Seed script

---

## Week 1, Day 1 — 2026-07-20

### Tasks Completed
- [x] Task 1 — Monorepo structure
- [x] Task 2 — Express backend scaffold
- [x] Task 3 — React frontend scaffold
- [x] Task 4 — Docker Compose
- [x] Task 5 — ESLint + Prettier

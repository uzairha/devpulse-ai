# Development Log

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

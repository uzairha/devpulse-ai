# Development Log

## Week 5, Day 27 — Tasks 111–113 — 2026-09-02

Component tests for the previously-uncovered shared UI. Client suite: 55 → **84**, all passing; lint unchanged.

### Task 111 — `RepoTables` (`RepoTables.test.jsx`, 12 tests)
- `PrStatusBadge`: Merged wins whenever `mergedAt` is set; Open / Closed otherwise.
- `Pagination`: renders null at ≤1 page; shows "Page X of Y"; disables the previous arrow on page 1 and the next arrow on the last page; clicking an arrow calls `onPage(page ± 1)`.
- `PrTable` / `CommitTable` (with `../services/api` mocked, wrapped in `MemoryRouter`): renders a row per record from `/analytics/:id/prs|commits`, shows the right empty state, and — for PrTable — refetches with `state=<tab>` in the query when a status filter tab is clicked.

### Task 112 — presentational widgets (4 files, 13 tests)
`PrSizeBreakdown`, `CommitTypeBreakdown`, `StalePrList`, `ContributorLeaderboard`. Each: renders nothing for missing/empty data (and, for PrSizeBreakdown, all-zero buckets); renders a row per datum with its label/count; plus one behaviour check per component — bar width scaled to the max bucket (the breakdowns), the `https://github.com/<repo>/pull/<n>` href with `target=_blank rel=noreferrer` (StalePrList), and 🥇🥈🥉-then-`#4` ranking with links to each contributor's detail page (ContributorLeaderboard).

### Task 113 — `DateRangePicker` interaction (`DateRangePicker.test.jsx`, +4 tests)
Beyond the existing pure `buildRangeQuery` tests: the active preset tab is marked and a click reports `{ days, startDate: null, endDate: null }`; "Custom" reveals two `input[type=date]`; a custom range is only reported via `onChange` once both dates are filled and `start <= end` (the draft-state fix from Task 82); and the picker opens straight into custom mode when the incoming `range` already carries both dates.

---

## Week 5, Day 26 — Tasks 109–110 — 2026-09-01

More client coverage, same session as Task 108. Client suite: 41 → **55**, all passing; lint unchanged (0 errors + the 1 pre-existing `ReportsPage` warning).

### Task 109 — `services/api.js` interceptor tests
`client/src/services/api.test.js` (8 tests). The axios instance registers its interceptors at import time, so the tests pull the handler functions straight off `api.interceptors.{request,response}.handlers[0]` and call them directly — no fake HTTP layer. Covers: the request interceptor attaching `Authorization: Bearer <token>` when a token is stored and leaving headers untouched when not; the response interceptor passing a success response through unchanged; rejection with the server's `error` message, with `'Something went wrong'` when the server sends none, and the same for a bare network error with no `response`; the 401 branch clearing the stored token and setting `window.location.href = '/login'`; and a non-401 error touching neither the token nor `location`. `window.location` is swapped for a plain `{ href: '' }` via `Object.defineProperty` per test and restored after.

### Task 110 — `ProtectedRoute` and `ErrorBoundary` tests
- `client/src/components/ProtectedRoute.test.jsx` (3 tests): mocks `useAuth`; renders nothing while `isLoading`, redirects to `/login` when there's no user (asserted through a real `MemoryRouter`/`Routes` with a `/login` stub route), renders children when a user is present.
- `client/src/components/ErrorBoundary.test.jsx` (3 tests): renders children normally; renders the fallback with the thrown error's `message` when a child throws (a `Bomb` component gated on a module-level flag); "Try again" clears the error state and re-renders the now-working child. `console.error` is stubbed for the duration since React logs caught render errors.

---

## Week 5, Day 26 — Task 108 — 2026-09-01

Page-level component tests for the two auth pages, building directly on the module-boundary mocking pattern from `AuthContext.test.jsx`. Here the boundary mocked is `../hooks/useAuth` (supplies `login`/`register` spies) and `react-router-dom`'s `useNavigate`, with a real `MemoryRouter` around the render so `<Link>` still resolves. `@testing-library/react`'s `fireEvent` throughout — still no `user-event` dependency. Client suite: 30 → **41**, all passing; client lint unchanged (0 errors, the 1 pre-existing `ReportsPage` `exhaustive-deps` warning).

- **`client/src/pages/LoginPage.test.jsx`** (5 tests): renders the form + register link; a successful submit calls `login({ email, password })` then `navigate('/dashboard')`; a rejected `login` shows `err.message` in the error banner and does not navigate; the button is disabled and reads "Signing in..." while the promise is pending, then re-enables; a resubmit clears the previous error banner (the `setError('')` at the top of `handleSubmit`).
- **`client/src/pages/RegisterPage.test.jsx`** (6 tests): renders the form + sign-in link; a matching-password submit calls `register({ email, password })` — asserting `confirmPassword` is dropped — then navigates; a mismatch shows "Passwords do not match", calls neither `register` nor `navigate`, and a corrected resubmit then succeeds; a rejected `register` shows the server message and does not navigate; the button is disabled and reads "Creating account..." while pending.
- Query note: the auth pages' `<label>`s aren't associated with their inputs (no `htmlFor`/`id`), so `getByLabelText` doesn't work — selected inputs by placeholder text instead.

---

## Week 5, Day 25 — Task 107 + client testing start — 2026-08-28 → 2026-09-01

**Status: verified 2026-09-01 — server 133/133, client 30/30.** These were written across three sessions during which an iCloud Drive sync daemon (`bird`), pegged at 60-85% CPU because the iCloud account was full, timed out `npm test`/`vitest` before its worker process could start (and stalled `git`). Resolved by moving the repo off iCloud to `~/code/devpulse-ai` and running the suites from a clean clone. See "Environment: moved off iCloud" below.

### Task 107 — BullMQ worker consumption tests
Enqueueing has been covered since Task 103/106 (repo-connect, webhooks); nothing exercised a worker actually processing a job. Decision: don't run a real BullMQ `Worker` against test Redis (non-deterministic, needs polling for async completion) — export the processor functions directly (`processSync` from `syncWorker.js`, `processWeeklyReports` from `reportWorker.js`, same precedent as Task 101's exported pure helpers) and call them with a fake job object. Reuses the Task 102/103 test-DB infra and mocking policy as-is.
- `server/src/workers/syncWorker.test.js` (7 tests): full success path (PRs/commits persisted, job completed, `lastSyncAt` updated), notify-on-success gated by `syncNotifications`, the firstReviewAt-already-known skip-refetch behavior, a single PR's review-fetch failure not aborting the sync, the no-GitHub-token failure path (SyncJob → `failed`, `sync_failed` notification, error rethrown — exercises the fix made after Task 93), and no SyncJob row created for an unknown repository.
- `server/src/workers/reportWorker.test.js` (5 tests): generate+persist+notify per opted-in repo, `weeklyReportEmail=false` skip, one report per repo for a multi-repo user, and one repo's generation failure not blocking another's (mocks `chat` to reject only when the prompt names a marker repo, since repo-processing order isn't guaranteed).
- Verified: server suite goes 121 → **133**, all passing. Both worker test files needed no changes on first real run.

### Client testing: first data-fetching/effect coverage
Client tests up to now only covered pure functions and stateless presentational components. Decision: mock the shared `client/src/services/api.js` axios instance as the client's outbound-HTTP boundary — the direct equivalent of mocking `githubApiService`/`openai.js` on the server.
- `client/src/context/AuthContext.test.jsx` (8 tests, via `renderHook`/`waitFor`/`act` from `@testing-library/react` — no `user-event` dependency added): `useAuth` outside a provider throws, initial load with/without a stored token, a rejected `/auth/me` clearing a stale token, login/register success + login failure, logout.
- **Fix needed to make these run:** this project's Node 26 / jsdom 30 combo doesn't expose a working Web Storage in the test environment — `globalThis.localStorage` and `window.localStorage` both resolve to `undefined`, so every AuthContext test threw in `beforeEach` on `localStorage.clear()`. `client/src/test/setup.js` now installs a minimal in-memory `localStorage`/`sessionStorage` on both `globalThis` and `window`. The 8 tests were correct as written. Client suite: 22 → **30**, all passing.

### Environment: moved off iCloud (2026-09-01)
Root cause of the multi-session `bird` thrash: the iCloud account was full (`brctl quota` → ~2.9 KB free), so `bird` was stuck in an endless failed-upload retry loop that starved filesystem and process I/O in `~/Documents`. At one point `~/Documents` itself went empty locally. No data lost — everything was intact in the iCloud container and pushed to `origin/main`. Fix: cloned fresh from GitHub, reinstalled deps, and relocated the working copy to **`~/code/devpulse-ai`** (outside any synced folder); deleted the stale iCloud copy. `git status` went from 30+ s to 0.04 s. Docker compose project name is unchanged, so the existing DB volumes carried over.

### Untracked CI-shakeout fixes (found via `git log`, not logged at the time)
Three commits landed between Task 106 and this entry that never got a dev-log write-up — presumably from getting the new `ci.yml` workflow (added in the AWS milestone) to actually pass:
- `7e929ce` — pinned `@eslint/js` back to `^9.39.5` (it had drifted to `^10.0.1` while `eslint` stayed on `^9.39.5`, and `@eslint/js`'s peer requirement made `npm ci` fail with `ERESOLVE` in CI) and regenerated both lockfiles.
- `e385062` — disabled the `react/prop-types` lint rule in the client. The codebase never used PropTypes anywhere, so the rule was flagging 148 pre-existing violations the moment `npm ci` actually succeeded and lint could run for the first time in CI.
- `fc038dd` — deferred several effects' direct async-fetch calls into a `Promise.resolve().then()` wrapper to satisfy `eslint-plugin-react-hooks`'s rule against synchronous `setState` inside an effect body (the fetch function set loading state before its first `await`). No behavior change.

---

## Week 5, Day 25 — Task 106 — 2026-08-26

Route-level integration tests for the four remaining route groups with no coverage: analytics, notifications, AI and webhooks. 48 new tests, server total now **121, all passing** (verified stable across 3 consecutive runs, no order-dependence). No application code changed — this task is pure test coverage. Followed the Task 102/103 test-DB + factories + supertest infrastructure and mocking policy (mock the outbound-HTTP boundary only, leave BullMQ real against test Redis) without needing to extend either.

- **`routes/analytics.test.js`** (18 tests) — the overview, compare, PR/commit listing and per-contributor endpoints. Emphasizes the same cross-user-isolation shape as Task 103's repos suite: every `:id` route asserts both the 403 and that nothing about the other user's repo leaked into the response. One caching test (a second identical-range request must not reflect a PR added in between) and one true-negative test (an empty repo list from `/compare` must be `200 []`, not treated as an error). Two factory-usage bugs caught while writing this, not in application code: `createPullRequest`/`createCommit`'s default `createdAt`/`committedAt` (2026-01-01) predates the default 30-day analytics window, so per-contributor tests needed an explicit recent date or the summary legitimately came back empty.
- **`routes/notifications.test.js`** (9 tests) — list/unread-count, mark-one-read, mark-all-read. `PATCH /:id/read` on another user's notification returns **404, not 403** — confirmed this is the existing, correct choice (`notificationService.markRead` looks up by id first and returns null on an owner mismatch, same as a genuinely missing id) since a 403 there would confirm the notification exists at all.
- **`routes/ai.test.js`** (14 tests) — pr-summary, health-score, weekly-report (generate + persisted history), chat. New mock boundary: `../lib/openai.js`'s `chat()`, not `githubApiService` — this is the first route suite that talks to an LLM. `calculateHealthScore` deliberately excluded from the mock: it is pure arithmetic over PR/commit rows with no LLM call (confirmed by asserting `chat` was never invoked in that test), so it stays covered end-to-end rather than mocked. The weekly-report test also asserts the `WeeklyReport` row is actually persisted with the mocked content, not just that the response looks right.
- **`routes/webhooks.test.js`** (7 tests) — HMAC signature verification (missing header, wrong signature), ping vs. push vs. other events, and the three branches that decide whether a sync gets queued (unknown `githubId`, `syncEnabled=false`, a sync already `running`). Signs the raw JSON body with the `GITHUB_WEBHOOK_SECRET` pinned in `.env.test.example`, matching what GitHub actually sends. One test-helper bug caught before it shipped: an object literal `{ signature: undefined }` passed to a destructured parameter with a default falls through to the default (JS destructuring treats an explicit `undefined` value as absent) — the "no signature header" test would have silently sent a valid one. Replaced with an explicit `omitSignature: true` flag instead of relying on `undefined`.

### Not done (deliberately, next session's problem)
- The BullMQ workers (`syncWorker`, `reportWorker`) are still untested at the consumption end — this task covers enqueue only (webhooks queuing a sync, same as Task 103's repo-connect flow), never a worker actually processing a job. Driving a worker in-process needs its own decision.
- Client-side testing is still limited to pure functions and stateless presentational components — no data-fetching/effect coverage, no page-level tests.

---

## AWS deployment-readiness milestone (Task 104–105) — 2026-08-25 → 2026-08-26

Separate from the Week 5 testing track and not in the original 150-task roadmap. Goal: make the repository credibly AWS-deployable — Terraform, production Docker images, CI/CD, ECS, RDS, ElastiCache, S3, Secrets Manager, CloudWatch — under a hard constraint of **$0 out of pocket, no AWS resources ever provisioned**. Broken into five sub-tasks with a review checkpoint after each.

### 1. Production images and config hardening — 2026-08-25 (committed)
- `server/Dockerfile` (multi-stage, `npm ci --omit=dev` + `prisma generate`, non-root `node` user, `tini` as PID 1 so ECS's SIGTERM on drain is forwarded) and `client/Dockerfile` (Vite build → `nginx-unprivileged`, static only).
- `config/index.js` now **fails fast** in production on a missing `DATABASE_URL` or a `JWT_SECRET` left at the dev default — a crash-looping task is cheaper than one serving forgeable tokens. Added `TRUST_PROXY_HOPS` (rate limiting must key on the real client IP behind an ALB) and `RUN_WORKERS_IN_API` (in production the worker is its own service; two consumers would double-process every sync).
- Liveness split from readiness: `/api/health` touches nothing external, `/api/health/ready` checks Postgres and Redis and reports booleans only — never the driver error, host or version, since it is reachable through the load balancer.
- `src/worker.js` extracted as a dedicated entrypoint; Compose gained a `full` profile running the whole stack from the production images.

### 2–3. Terraform — 2026-08-25
`infrastructure/aws/terraform/`, ~2,100 lines across 16 files. VPC with public/private subnets per AZ; the ALB → ECS → RDS/ElastiCache security-group chain (data stores accept traffic only from the ECS security group, never from a CIDR block); ECR; ALB with path-routing (`/api/*` → backend, everything else → nginx, so there is no production CORS to manage); three Fargate services on ARM64/Graviton; separate execution and task roles; RDS Postgres; ElastiCache Redis with AUTH + TLS; S3 for future uploads; five Secrets Manager secrets, three of them Terraform-generated so there is no human-typed value to leak; CloudWatch log groups and seven optional alarms.

Cost-shaped defaults throughout, each documented at its variable: `enable_nat_gateway = false` in the example tfvars (the NAT Gateway is ~$32/month idle, by far the largest fixed cost — tasks move to public subnets, still inbound-restricted to the ALB), no Multi-AZ, no automated backups, alarms off, Container Insights off, `secrets_recovery_window_days = 0`.

### 4. CI/CD — 2026-08-25
`.github/workflows/ci.yml` (the repository had none): server lint + the 73-test integration suite against Postgres/Redis service containers, client lint + tests + production build, both Docker images built and discarded, and `terraform fmt`/`validate` with `-backend=false`. Nothing in CI can reach AWS. `deploy-aws.yml` is inert behind two independent gates: a `vars.AWS_DEPLOY_ENABLED == 'true'` condition, and OIDC against a role that does not exist — there are no AWS credentials in this repository at all.

### 5. Security review, validation sweep and docs — 2026-08-26

Full read of all 2,100 lines of Terraform and both workflows against the application code. **Five findings, all fixed.**

1. **ECR immutability and the `:latest` push were incompatible — the second deploy would have failed.** `ecr.tf` set `image_tag_mutability = "IMMUTABLE"` while `deploy-aws.yml` pushed `:${IMAGE_TAG}` *and* `:latest` every run; ECR rejects re-writing an existing tag. Resolved in favour of keeping immutability (a deployed tag can never be silently swapped — the stronger supply-chain property): the `:latest` push is gone, deploys tag `sha-<commit>` and render that exact tag into the task definition, and a new `var.bootstrap_image_tag` covers the one case that genuinely needs a fixed tag — the first apply, where a task definition must name *some* image that exists.
2. **HTTP was never redirected to HTTPS.** Once `certificate_arn` was set, `:80` kept serving the application alongside the new HTTPS listener. Every API call carries an `Authorization: Bearer` token, so that was an alternate plaintext route for handing out JWTs. The `:80` listener now switches to a 301 redirect whenever a certificate exists, and the `http_api` rule is dropped in that case so the redirect catches every path. Related: `local.app_base_url` hardcoded `https://` whenever `app_domain` was set even with no certificate — scheme and host are now decided independently, so the OAuth callback URL can no longer advertise a scheme the ALB does not serve.
3. **The ECR lifecycle policy matched nothing the pipeline pushed.** Rule 1 filtered on `tagPrefixList = ["v", "sha-", "latest"]` but the workflow tagged with a bare `github.sha`, which matched neither that list nor the untagged rule — those images would have accumulated and billed forever. The workflow now tags `sha-<commit>`, and `bootstrap` is deliberately excluded from the expiry list so a fresh apply's image is never expired out from under it.
4. **Nothing applied Prisma migrations to the production database.** Neither the pipeline nor the container entrypoint ran them, so the first deploy would have booted the API against an RDS instance with no tables. The deploy workflow now runs `npx prisma migrate deploy` as a one-off Fargate task from the *new* image, before any service is updated — deploying first would mean serving requests against a schema missing its columns. A non-zero exit fails the job, leaving the services on the previous image rather than half-deploying against a half-migrated database. This works because `prisma` is a regular dependency rather than a devDependency, so the CLI and schema both survive `npm ci --omit=dev` into the production image. Three new outputs (`ecs_subnet_ids`, `ecs_security_group_id`, `ecs_assign_public_ip`) exist because `run-task`, unlike a service, has no stored network configuration to inherit.
5. **Broken cross-reference.** Four `.tf` files cited "the standing no-provisioning policy in the repository root README" — the README had no AWS section at all. Now written down, with the three mechanisms that actually enforce it.

**Reviewed and found already correct** (recorded so it is not re-litigated): IAM is genuinely least-privilege — Secrets Manager scoped to the five exact ARNs, S3 to one bucket's `uploads/` prefix, no `*` resources, and the frontend correctly has no task role since nginx calls no AWS API; RDS is non-public with encrypted storage; Redis has AUTH plus encryption in transit and at rest; all four credential variables are `sensitive`; state files and `terraform.tfvars` are gitignored, and `.terraform/` provider binaries are correctly ignored too; the readiness endpoint and the error handler both already withhold internals in production; both containers run non-root.

**Validation sweep — all run, not assumed:** `tofu fmt -check -recursive` clean, `tofu validate` Success, `actionlint` clean on both workflows, server lint clean, client lint at exactly 149 problems (the recorded baseline — no regression), 73/73 server tests passing, 22/22 client tests passing. No application code was changed by this sub-task.

**New: `docs/aws-deployment.md`** — architecture, the security posture and its reasoning, a per-component cost table, the full bootstrap sequence, OIDC and repository-variable setup, the deploy pipeline, adding TLS/alarms/remote state, teardown, and an honest known-gaps list (no autoscaling, no blue/green, no WAF, no VPC endpoints, backups off).

### Notes
- OpenTofu is used locally for `fmt`/`validate` (Homebrew no longer ships the Terraform CLI); CI uses real Terraform via `hashicorp/setup-terraform`. The configuration validates under both.
- Both Dockerfiles pin `npm@11.12.1` before `npm ci`: `node:22-alpine` bundles npm 10, whose resolver treats this lockfile's `eslint@^9` / `@eslint/js@^10` optional peer conflict as fatal even under `--omit=dev`, where neither package is installed at all.

---

## Week 5, Day 24 — Tasks 102–103 — 2026-08-24

### Tasks Completed
- [x] Task 102 — Integration test infrastructure (test database + factories) and the first route-level suite
- [x] Task 103 — Integration tests for the repository routes, incl. the outbound-HTTP mocking decision

### Test database strategy (the decision this task existed to make)
Task 101 deliberately left this open. Three options were weighed:
- **Per-test transaction + rollback** — rejected. Every service imports the `prisma` singleton from `lib/prisma.js`, so isolating a test inside a transaction would mean threading a transactional client through every service and controller. It also cannot work through supertest at all: the request handler runs in its own async context, with no access to a transaction the test opened. Large refactor, no payoff outside tests.
- **Testcontainers** — rejected for now. Cleanest isolation, but a heavyweight dependency with per-run container startup cost, and Docker-in-CI is a Week 6 concern. Worth revisiting when CI is actually built (Tasks 126–150).
- **Separate `devpulse_test` database + truncate between tests** — chosen. Reuses the Postgres container already in `docker-compose.yml`, schema applied with `prisma migrate deploy`, and truncation costs milliseconds per test where `prisma migrate reset` costs seconds.

Two sub-decisions came with it:
- **Explicit factories, not `prisma/seed.js`.** The seed script randomizes `firstReviewAt` and cycles commit messages on purpose, to make the demo look realistic — exactly the wrong property for assertions. `src/test/factories.js` builds minimal, fixed rows instead: a test that cares about a value passes it in, anything it doesn't name gets a deterministic default.
- **Real Redis on logical database 1**, not a mocked cache module. Redis is already running, so the real cache path gets exercised; `REDIS_URL` ends in `/1` so test keys never touch the dev keyspace on db 0.

### Approach
- **`src/app.js` extracted from `src/index.js`.** This was the blocker: the old `index.js` built the Express app, started both BullMQ workers, scheduled the weekly-report cron, and called `app.listen()` all at module scope, so nothing could import the app without booting the entire system. `app.js` now exports the configured app and nothing else; `index.js` is a thin entrypoint that imports it, starts the workers, and listens.
- **Rate limiters skipped under `NODE_ENV=test`.** The auth limiter allows 20 requests per 15 minutes — a single suite blows through that and starts getting spurious 429s. Both limiters now take `skip: () => config.nodeEnv === 'test'`. `morgan` request logging is also disabled in test to keep output readable.
- **`vitest.config.js` (new).** Reads `.env.test` and passes it through `test.env` rather than loading it in the config process, so values land in the test workers before `config/index.js` reads `process.env` (dotenv does not overwrite already-set variables, so the dev `.env` can only fill in keys `.env.test` omits). `fileParallelism: false` — the suites share one database and truncate between tests, so concurrent files would delete each other's rows mid-test.
- **`src/test/setup.js` (new).** Truncates every table between tests (table list read from `pg_tables` at runtime, so new Prisma models are picked up automatically rather than needing a hand-maintained list) and flushes the Redis test database. Closes Prisma, both BullMQ queues and Redis in `afterAll` — importing `app.js` pulls all of them in transitively, and each holds an open connection that would otherwise keep Vitest alive after the run.
- **Safety guards.** Because this file truncates tables, it refuses to run unless `DATABASE_URL`'s database name ends in `_test` and `REDIS_URL` names a non-zero logical database. Both guards run at module scope, before anything touches Postgres or Redis.
- `.env.test` is gitignored (matching the existing `.env` convention); `.env.test.example` is committed with setup instructions.

### Tests Added
23 integration tests in `src/routes/auth.test.js`, covering register (duplicate email, validation, password actually stored hashed, token carries the right user id, hash never serialized in a response), login (wrong password, unknown email, and the OAuth-user-with-no-`passwordHash` case), `GET /me` (missing/malformed/forged/expired token, and valid-token-but-deleted-user), and `PATCH /settings` (partial updates, non-boolean values ignored, and confirmation that the request body can't write fields other than the two toggles). Server total is now 46 tests, all passing.

### Verification
- Full suite green, process exits cleanly (no hanging Redis/BullMQ handles).
- Dev database confirmed untouched after a test run (2 users / 2 repos / 20 PRs / 40 commits, unchanged); test database confirmed empty.
- **Both safety guards were tested rather than assumed** — an untested guard protecting the dev database is worthless. Pointed `DATABASE_URL` at a throwaway `devpulse_scratch` database holding canary rows: the run refused to start and the canary rows survived. Pointed `REDIS_URL` at db 0 with a canary key: the run refused and the key survived. Scratch database and canary key cleaned up afterwards.
- App boot verified after the entrypoint refactor: `node --watch` restarted cleanly, `/api/health` 200, and a real login → JWT → `GET /api/repos` round trip returned seeded data.
- Lint: server shows exactly the 1 pre-existing `no-console` warning (now at `index.js:12` after the refactor), no new problems. Client untouched this task.

### Not done (carried into Task 103 and later)
- Only the auth routes have integration coverage. Repos, analytics, notifications, AI and webhook routes are still untested at the route level.
- Nothing yet covers the BullMQ workers (`syncWorker`, `reportWorker`) or the GitHub/OpenAI service layer — those need outbound HTTP mocking, which is its own decision.
- Test database creation is still a documented manual step (`CREATE DATABASE devpulse_test` + `npm run test:db:migrate`) rather than an automated global setup.

---

## Task 103 — Repository route integration tests — 2026-08-24

### What to mock (the decision this task forced)
The repo routes are the first ones with outbound dependencies, so this settled the policy for the rest of Week 5:
- **`githubApiService` is mocked** (`vi.mock`). Real outbound HTTP must never fire from a test — it would be slow, need a real token, and depend on GitHub being up. This is the only thing stubbed.
- **BullMQ is left real.** Jobs are enqueued against the test Redis database (logical db 1) and flushed between tests by `setup.js`, so nothing accumulates and no worker is running to consume them. Enqueue assertions go through `syncQueue.getJobCounts()` against actual Redis, which covers the real enqueue path instead of asserting that a stub was called.
- `GITHUB_WEBHOOK_SECRET` and `WEBHOOK_BASE_URL` are pinned in `.env.test`, so the webhook-registration branches behave identically whether or not a developer's dev `.env` defines them.

### Tests Added
27 integration tests in `src/routes/repos.test.js` across all seven repo routes. The emphasis is **cross-user isolation** — every route that takes an `:id` has a `repo.userId !== req.user.id → 403` check, and a regression there would leak one customer's repository data to another, so each is covered explicitly (sync, sync-status, delete, and enable-auto-sync all assert both the 403 *and* that no side effect occurred). Also covered: the webhook-registration-fails-but-connection-succeeds path, the sync-already-running 409, cascade deletion of dependent rows, and validation rejections landing before any GitHub call is made. Server total is now 73 tests, all passing (suite run three times to confirm no order-dependence or flakiness).

### Finding — sparkline emits 15 points for a "14-day" window
A test asserting `activitySparkline` had 14 entries failed with 15. `SPARKLINE_DAYS` is 14 and `getRepoActivitySparkline` sets `since = now - 14 days`, but `buildDailyBuckets` is inclusive at both ends (`while (cursor <= end)`), so the series actually spans day −14 through today: 15 points.

Checked specifically whether the length is *unstable*, since `getRepoActivitySparkline` computes `since` with local-time `setDate()` while `buildDailyBuckets` normalizes with `setUTCHours()` — the same local-vs-UTC mixing behind the Task 101 bug. It is not: the inclusive range yields 15 regardless of the time of day the request lands. So this is a naming/output mismatch, not a defect, and changing it would alter the rendered chart. Pinned the real behaviour in the test with a comment rather than "fixing" a cosmetic discrepancy from inside a testing task. Worth tidying deliberately later if the 14-day label is meant literally.

### Verification
Full suite green and stable across three consecutive runs; process exits cleanly. Dev database re-checked after all runs and still intact (2 users / 2 repos / 20 PRs / 40 commits). Server lint unchanged (1 pre-existing `no-console` warning).

### Not done (left for later Week 5 tasks)
- Analytics, notifications, AI and webhook routes still have no route-level coverage.
- The BullMQ workers themselves (`syncWorker`, `reportWorker`) are still untested — enqueueing is covered, consuming is not.
- Test database creation remains a manual step rather than automated global setup.

---

## Week 5, Day 21 — Task 101 — 2026-08-22

### Tasks Completed
- [x] Task 101 — Testing infrastructure: Vitest for both client and server, first unit/component tests

### Approach
Opening task for Week 5 (Comprehensive Testing, Tasks 101–125). No test framework existed on either side of the stack. Chose Vitest for both client and server rather than mixing Jest/Mocha — client already runs on Vite so config is nearly free, and a single test runner across the monorepo keeps tooling consistent. Started with pure-function/presentational-component coverage that needs no test database, rather than jumping straight to Prisma-backed integration tests — that's a bigger infra decision (test DB strategy, fixtures/seeding) better suited to its own task now that the runner itself is proven out.
- Server: `vitest` added as a devDependency, `npm test` / `npm run test:watch` scripts. Exported the previously-private pure helpers in `analyticsService.js` (`buildCommitTypeBreakdown`, `buildPrSizeBreakdown`, `buildDailyBuckets`, `buildHeatmapCells`, `buildWeeklyBuckets`, `CONVENTIONAL_COMMIT_RE`) and `resolveRange` in `analyticsController.js` so they're directly testable.
- Client: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/dom` added as devDependencies. `vite.config.js` gained a `test` block (`environment: 'jsdom'`, `setupFiles: './src/test/setup.js'`); the setup file wires up `@testing-library/jest-dom`'s matchers and an `afterEach(cleanup)` (RTL's auto-cleanup needs `test.globals: true`, which this config doesn't set, so cleanup is registered explicitly instead).
- Test files: `server/src/services/analyticsService.test.js`, `server/src/controllers/analyticsController.test.js`, `client/src/components/Sparkline.test.jsx`, `client/src/components/MetricCard.test.jsx`, `client/src/components/DateRangePicker.test.jsx`. 45 tests total (23 server, 22 client), all passing.

### Bug found and fixed
Writing a straightforward test for `buildDailyBuckets` (fill a date range with zero-count buckets, keyed by UTC ISO date) failed on this dev machine. Root cause: the function normalized its loop cursor with local-time `setHours(0,0,0,0)`/`setDate()` while keying buckets with UTC `toISOString().slice(0,10)` — on any server/dev machine not running in UTC (this one is America/Los_Angeles), that mismatch silently shifts every daily bucket by a day. Affects `getCommitMetrics`'s `dailyActivity` and `getRepoActivitySparkline`. Fixed by switching the cursor math to `setUTCHours`/`setUTCDate`, matching the UTC approach `buildHeatmapCells` already used. This is exactly the kind of regression Week 5 testing is meant to catch — first concrete payoff from Task 101.

### Tests Added
45 new tests (see above). Lint: client stayed at 149 problems (148 errors + 1 warning, matching the Task 100 baseline exactly — new test files add zero new errors). Server lint unchanged (1 pre-existing `no-console` warning).

### Not done (left for a later Week 5 task)
- No Prisma-backed integration tests yet (would need a test-database strategy — separate schema/DB, per-test transactions or truncation, fixture data).
- No React component tests that exercise data fetching/effects (`DateRangePicker`'s interactive draft-state behavior, `PrTable`/`CommitTable`, page-level components) — today's client tests deliberately stuck to pure functions and stateless presentational components.
- No CI wiring — `npm test` runs locally only; CI is Week 6's territory (Tasks 126–150).

---

## Post-Week-4 cleanup — 2026-08-21

### Approach
Small follow-up, not a numbered task: the PR/commit table pagination limit (default 25, max 100) was hardcoded as a duplicated magic number in two places — `routes/analytics.js`'s `express-validator` rule and `analyticsController.js`'s `listPullRequests`/`listCommits` clamp — flagged as a known issue at Week 4's close. Extracted both into a shared `server/src/lib/constants.js` (`DEFAULT_TABLE_LIMIT`, `MAX_TABLE_LIMIT`) so the two can't drift apart.

### Files Modified/Created
- `server/src/lib/constants.js` (new)
- `server/src/routes/analytics.js`, `server/src/controllers/analyticsController.js` — import and use the shared constants.

### Tests Added
- None. Verified directly against the running server: request with `limit=999` still correctly 400s (validator rejects before the controller's clamp ever runs — confirms the controller's `Math.min` was already dead code on the over-max path, behavior unchanged), request with no `limit` still defaults to 25. Lint clean.
- Also cleaned up 8 stale zombie `node --watch src/index.js` processes accumulated across past sessions (none were holding the port) while restarting the server to test this change.

---

## Week 4, Day 23 — Task 100 — 2026-08-20

### Tasks Completed
- [x] Task 100 — Week 4 review, lint sanity check, and docs wrap-up

### Approach
Closing task for Week 4, same shape as Week 3's closing task (Task 75): a review/lint pass plus catching up the docs, no new feature surface.
- Full `git status` (not just modified files) checked for silently-accumulating untracked files or dependency drift — none found, working tree only has this week's expected changes.
- `npm run lint` re-run on both client and server: client shows 149 problems (148 errors + 1 warning), exactly matching the expected running total after Task 97's `Sparkline.jsx`/`ReposPage.jsx` additions (139 after Task 96 + 10 from Task 97, Task 98 added 0) — confirmed no regressions across Tasks 95–99. Server lint clean (1 pre-existing unrelated `no-console` warning, unchanged).
- `docs/development-log.md` and `docs/roadmap.md` caught up for Tasks 91–98 (had drifted behind committed work — 2nd occurrence of this, see note below) and now this Week 4 Summary.

### Known Issues carried into Week 5
- `redis.keys('analytics:<repoId>:*')` cache invalidation pattern — fine at this app's scale, wouldn't scale to a much larger keyspace.
- Repos connected before Task 71 don't have a webhook registered retroactively (Task 83 added retroactive registration going forward, but doesn't backfill pre-71 repos with no PR/commit activity since to trigger it).
- Compare view's Redis cache key isn't cleared by `invalidateRepoCache`, bounded by the existing 120s TTL.
- Webhook delivery health cannot be verified in this local dev environment — no public URL / ngrok tunnel configured for `WEBHOOK_BASE_URL`. Noted across several sessions as the reason webhook-delivery-health tracking was never picked as a task; would need real infra (or a documented mock) to build against.
- 100-row cap on CSV/JSON export (server-side query limit, not currently configurable).
- Client lint carries 149 pre-existing `react/prop-types`/`react-hooks/set-state-in-effect` errors — consistent, sitewide convention decision (no PropTypes anywhere in this app), not treated as blocking debt.
- `docs/development-log.md` has now fallen behind actual committed work twice (Week 4 Day 20→21 gap, and again Day 20→22 gap this week) despite being updated at both Week 3's and this session's close — worth checking `git log` against the dev-log head at the start of every session, not just when something seems off.

### Tests Added
- None (review/docs task, no code behavior changed beyond Task 99 which shipped separately).

### Week 4 Summary
All 25 tasks complete (Tasks 76–100). Webhooks, UX polish, and advanced analytics:
- Retroactive webhook registration for repos connected before Task 71; webhook-delivery-health tracking deferred indefinitely — can't be verified without a public callback URL in local dev
- Custom date-range picker (backend range-based signatures, frontend draft-state date inputs) replacing preset-only day windows
- Period-over-period trend badges (Dashboard, RepoDetail, ContributorDetail), text search on PR/commit tables, CSV export, shared `MetricCard` component extraction
- Contributor leaderboard, cross-repo comparison view, app-wide dark mode (CSS custom-property token retrofit)
- Day-of-week × hour-of-day activity heatmap, scheduled weekly AI report generation (BullMQ repeatable job) with a "Past reports" history view
- Clickable/actionable notifications with deep links to their source (plus a bug fix: no-token sync failures were failing silently with no notification)
- Stale open PR widget, PR review turnaround metric, commit message compliance tracker (Conventional Commits), repo activity sparkline on the Repositories list
- Compare page extended to match per-repo metrics as they were added, so it never fell out of sync
- Seed script gained a `--reset` mode (Task 99) to fix a recurring staleness issue that had bitten testing across four separate sessions

### Next: Week 5 — Comprehensive Testing (Tasks 101–125)
- Task 101: TBD — see `docs/roadmap.md` for the week's focus areas

---

## Week 4, Day 23 — Task 99 — 2026-08-20

### Tasks Completed
- [x] Task 99 — Reset + reseed seed mode

### Approach
`prisma/seed.js` used `upsert` with `update: {}` everywhere, so once a row existed (by githubId/sha/etc.), reseeding never touched its content or timestamps. Since every seeded PR/commit timestamp is computed relative to `Date.now()` *at first insert*, seed data has been silently going stale as real time passes — this has caused a testing wrinkle in four separate prior sessions (Tasks 91, 95, 96, 97: dashboard's default 30d range showing no data, `firstReviewAt`/commit-message content changes needing manual one-off backfill scripts). Added a `--reset` flag: `prisma.user.deleteMany({ where: { email: SEED_EMAIL } })` before seeding, relying on `onDelete: Cascade` on every downstream relation (Repository → SyncJob/PullRequest/Commit/WeeklyReport, User → Notification) to clean up everything in one call. Scoped to just the one seed email — safe, not a full DB wipe (confirmed a pre-existing unrelated `newuser@test.com` test account was untouched).

### Files Modified/Created
- `server/prisma/seed.js` — `--reset` CLI flag, `SEED_EMAIL` constant.
- `server/package.json` — new `seed`/`seed:reset` npm scripts (`prisma db seed` / `prisma db seed -- --reset`).

### Tests Added
- None. Verified directly: `npm run seed:reset` produced fresh timestamps (newest PR/commit within a day of "now"), a follow-up plain `npm run seed` stayed idempotent (no duplicate rows), lint clean. Confirmed in-browser (claude-in-chrome): Dashboard's default 30d range now shows data immediately (previously needed 90d), Repositories page sparklines show real shape and "Active yesterday" without the temporary-row workaround used in Task 97.

### Known Issues / Notes
- Same carryover as before (`redis.keys()` cache invalidation, 100-row export cap, retroactive webhook registration, webhook delivery untestable without a public URL).

### Next: Week 4, Task 100
- Task 100 closes out Week 4 — likely a wrap-up/polish task (matches the Week 3 Day 15 pattern of a review+docs task as the last task of the week). Pick at next session start.

---

## Week 4, Day 22 — Tasks 95–98 — 2026-08-19

### Tasks Completed
- [x] Task 95 — PR review turnaround metric
- [x] Task 96 — Commit message compliance tracker (Conventional Commits)
- [x] Task 97 — Repo activity sparkline on Repositories list
- [x] Task 98 — Surface review turnaround + commit compliance on Compare page

### Approach
Four tasks in one sitting. Task 95 adds `PullRequest.firstReviewAt` (new migration) populated via `githubApiService.getPrReviews`, synced best-effort (a per-PR review-fetch failure logs a warning and falls back to `null` rather than failing the whole sync); `analyticsService.getPrMetrics`/`getPeriodComparison`/`getContributorSummary` all gained `avgReviewTurnaroundHours` and matching trend, surfaced as a new "Avg Review Turnaround" `MetricCard` on Dashboard, RepoDetail, and ContributorDetail. Task 96 adds `getCommitMetrics.complianceRate`/`typeBreakdown` (regex-matched against the Conventional Commits spec), a new `CommitTypeBreakdown.jsx` component (reuses `PrSizeBreakdown.jsx`'s bar-list CSS with a new wider label modifier), wired into Dashboard/RepoDetail only (not ContributorDetail, matching the existing repo-level-only precedent for `sizeBreakdown`). Task 97 is a deliberate change of pace after six MetricCard/bar-list-shaped widgets in a row — a compact inline-SVG sparkline (`Sparkline.jsx`) on each Repositories-list card showing 14 days of PR+commit activity, plus a `timeAgo` freshness label. Task 98 closes the loop by threading Task 95/96's two new metrics into the Compare page table so it doesn't fall out of sync with the per-repo views.

### Files Modified/Created
- `server/prisma/schema.prisma` + migration `20260819222759_add_first_review_at` — `PullRequest.firstReviewAt DateTime?`.
- `server/src/services/githubApiService.js` — `getPrReviews(accessToken, owner, repo, pullNumber)`.
- `server/src/workers/syncWorker.js` — fetches reviews per synced PR, computes `firstReviewAt` as earliest `submitted_at`; skipped for already-cached merged/closed PRs to save API calls.
- `server/src/services/analyticsService.js` — `avgReviewTurnaroundHours` (Task 95), `complianceRate`/`typeBreakdown` via new `buildCommitTypeBreakdown` helper (Task 96), `getRepoActivitySparkline` (Task 97, hardcoded 14-day window, reuses `buildDailyBuckets`).
- `server/src/controllers/repoController.js` — `listRepos` now attaches `activitySparkline`/`lastActivityAt` per repo via `Promise.all`.
- `server/src/controllers/analyticsController.js` — `compareRepos` gained `avgReviewTurnaroundHours`/`commitComplianceRate` per repo (Task 98).
- `client/src/components/CommitTypeBreakdown.jsx` (new), `Sparkline.jsx` (new, also exports `timeAgo`).
- `client/src/pages/DashboardPage.jsx`, `RepoDetailPage.jsx`, `ContributorDetailPage.jsx`, `ReposPage.jsx`, `ComparePage.jsx` — wired in the above.
- `server/prisma/seed.js` — `commitMessageFor(i)` cycling through conventional + non-compliant templates (was previously always-identical, which would have trivially shown 100% compliance); PRs with `reviewCount > 0` get a randomized `firstReviewAt`.

### Tests Added
- None. Verified end-to-end in-browser (light + dark, 90d range — 30d has no data for this seed repo, same recurring quirk as Task 91) on all affected pages: turnaround card shows 5h/8h avg, compliance shows 70% with correct type breakdown, sparkline renders correctly once seeded with recent-offset test data (temporary rows inserted and removed via one-off script), Compare page values match per-repo pages. No console errors.

### Known Issues / Notes
- `seed.js`'s `upsert` with `update: {}` means schema/content changes to already-seeded rows require a manual one-off backfill script, not just a reseed — this has now bitten on Tasks 91, 95, 96, and 97. Worth a "reset + reseed from empty" seed mode if it keeps recurring.
- Same carryover as before (`redis.keys()` cache invalidation, 100-row export cap, retroactive webhook registration for pre-Task-71 repos, webhook delivery untestable without a public URL).

### Next: Week 4, Task 99+
- TBD — pick at next session start.

---

## Week 4, Day 21 — Tasks 91–94 — 2026-08-18

### Tasks Completed
- [x] Task 91 — Repo activity heatmap (day-of-week x hour-of-day)
- [x] Task 92 — Scheduled weekly AI report generation
- [x] Task 93 — Clickable/actionable notifications
- [x] Task 94 — Stale open PR widget

### Approach
Task 91 adds `getActivityHeatmap` (168-cell day×hour grid combining PR-created + commit timestamps) surfaced as a new `ActivityHeatmap.jsx` component using `color-mix()` for theme-aware intensity, no new CSS tokens needed. Task 92 completes a previously dead feature — `User.weeklyReportEmail` was already a persisted Settings toggle but nothing read it; since this stack has no email/SMTP infra, this is in-app only (auto-generate + persist + notify), so the Settings label was corrected from "Weekly report emails" to "Weekly reports" to stop overpromising. New `WeeklyReport` model, BullMQ repeatable job (`0 9 * * 1`) in a new `reportWorker.js`. Task 93 makes notifications clickable/navigable (previously they only marked read) via a new `Notification.link` column, closing the dead-end left by Task 92's new notification type. Task 94 adds a stale-open-PR widget (7+ days open, oldest-first) — chosen over webhook-delivery-health tracking, which can't be verified in this local dev environment (no public URL for GitHub to call back to).

### Files Modified/Created
- `server/prisma/schema.prisma` + migrations `20260818232904_add_weekly_report`, `20260818234157_add_notification_link`.
- `server/src/services/analyticsService.js` — `getActivityHeatmap`/`buildHeatmapCells` (Task 91), `getStalePrs` (Task 94, independent of the date-range picker, hardcoded 7-day threshold, top 8 oldest).
- `server/src/services/aiService.js` — `generateAndSaveWeeklyReport`, `listWeeklyReports`.
- `server/src/lib/queue.js` — `reportQueue`; `server/src/workers/reportWorker.js` (new) — repeatable cron job, notifies every repo owner with `weeklyReportEmail=true`.
- `server/src/index.js` — `startReportWorker()` + `scheduleWeeklyReports()` wired in.
- `server/src/services/notificationService.js` — `createNotification` takes an optional `link`.
- `server/src/workers/syncWorker.js` — sets `link` on sync notifications (`/repos/:id`); also fixed a pre-existing bug found while testing Task 93 — the missing-GitHub-token check threw before the try/catch that records `SyncJob`/creates the failure notification, so a no-token sync (e.g. this local dev environment) failed completely silently. Moved the check inside the try block.
- `client/src/components/ActivityHeatmap.jsx` (new), `StalePrList.jsx` (new).
- `client/src/components/Layout/Header.jsx` — `NotificationBell` now navigates via `useNavigate` on click when `link` is set, plus a distinct icon/style for the new `weekly_report` type.
- `client/src/pages/ReportsPage.jsx` — reads `?repo=` from the URL to preselect + auto-display the most recent report; new "Past reports" history list.
- `client/src/pages/SettingsPage.jsx` — corrected label/hint text.
- `client/src/pages/DashboardPage.jsx`, `RepoDetailPage.jsx` — wired in heatmap + stale-PR widget.

### Tests Added
- None. Verified end-to-end in-browser (claude-in-chrome) on Dashboard/RepoDetail in both themes: heatmap shows two clear activity clusters, weekly report generates and appears in history, notification click-through navigates correctly for both `sync_complete` and `weekly_report` types (tested via one-off inserted/removed rows since this dev environment has no real GitHub token to trigger a real sync), stale PRs correctly sorted oldest-first with working GitHub links. No console errors.

### Known Issues / Notes
- Had to kill+restart the `node --watch` dev server after each `prisma migrate dev` this session — `node --watch` doesn't watch `node_modules/`, so it never picks up a regenerated Prisma client on its own. This will recur on every future schema change.
- 30d dashboard default range showed "No data yet" for a 90d-old seed repo — switch to 90d to see data on this seed.
- Webhook delivery health still can't be verified locally (needs a public URL / ngrok tunnel, `WEBHOOK_BASE_URL` not configured).

---

## Week 4, Day 20 (cont.) — Task 90 — 2026-08-17

### Tasks Completed
- [x] Task 90 — Dark mode toggle

### Approach
Retrofitted the app's ~2,300 lines of hardcoded-hex CSS onto a small set of semantic custom-property tokens (`--bg`, `--text`, `--border`, `--accent`, `--success`, `--warning`, `--danger`, `--purple`, plus `-bg`/`-hover`/`-strong`/`-subtle` variants of each), defined once in `client/src/index.css` under `:root` (light values) and overridden under `[data-theme='dark']`. Values were mapped mechanically (same hex → same token everywhere, since it was already a small consistent Tailwind-gray/blue/red/green/purple palette) then applied via a scripted `sed` pass across every CSS file, followed by manual review.

### Files Modified/Created
- `client/src/index.css` — full token set (light + dark), replaces the old hardcoded `body` color/background.
- All other `client/src/**/*.css` (13 files) — hardcoded hex values swapped for `var(--token)` equivalents via scripted substitution, then hand-reviewed.
- `client/src/context/ThemeContext.jsx` / `client/src/hooks/useTheme.js` (new) — same Provider+hook shape as the existing `AuthContext`/`useAuth`. Initializes from `localStorage` (`devpulse-theme`) or `prefers-color-scheme` if nothing stored; sets `data-theme` on `<html>`; toggling persists to `localStorage`.
- `client/src/main.jsx` — wraps the app in `ThemeProvider` (outside `AuthProvider`, so the theme applies even on the login/landing pages).
- `client/src/components/Layout/Header.jsx` / `Layout.css` — new `ThemeToggle` button (☀/☾) next to the notification bell.
- `client/src/pages/SettingsPage.jsx` — new "Appearance" section with a Dark mode toggle (reuses the existing `.toggle` switch component), kept in sync with the header button via the shared `useTheme` hook.
- `client/src/pages/ComparePage.jsx`, `RepoDetailPage.jsx`, `components/ErrorBoundary.jsx` — inline JS-computed hex colors (health-score bands, error boundary styling) switched to the same `var(--token)` values so they respect the theme too.

### Two bugs caught before shipping
1. The initial blind `color: white` → `var(--bg)` mapping was wrong for text sitting on colored surfaces (buttons, badges, chat bubbles, avatar initials) — in dark mode `--bg` becomes a dark color, so button text would have gone dark-on-dark. Fixed by adding a dedicated `--on-accent` token (always white, not redefined in the dark block) and remapping those ~15 call sites to it.
2. The sidebar (`Layout.css` `.sidebar`) is intentionally a fixed dark surface in both themes (matches the pre-existing design). The mechanical sed pass initially pointed its background/hover-text at flipping tokens (`--text`/`--bg-subtle`), which would have inverted the sidebar to near-white in dark mode. Fixed by reverting those two declarations to literal hex, matching the sidebar's other already-hardcoded colors (`#1f2937`, `#1e3a5f`, `#60a5fa`) which were correctly left untouched by the mapping.

### Scope decisions
- Sidebar stays permanently dark regardless of app theme (unchanged design).
- GitHub OAuth button on the login page keeps its literal brand colors (`#24292e`/`#1a1e22`), not tokenized.
- Landing and login/register pages are included (the `ThemeProvider` wraps the whole app, not just the authenticated `Layout`), so the toggle preference applies everywhere, though there's no toggle control on those pages themselves.

### Tests Added
- None. Verified in-browser: toggled via both the header button and the Settings switch (stay in sync), confirmed correct light/dark rendering on Dashboard, RepoDetail (Overview/Chat tabs, health score card), Repositories, Compare, and Settings; confirmed the app respects `prefers-color-scheme` on first load with nothing in `localStorage`; no console errors in either theme.

### Known Issues
- Same carryover as Day 19/89 (`redis.keys()` cache invalidation, 100-row export cap, compare-view cache not invalidated on sync).

### Next: Week 4, Task 91+
- TBD — pick at next session start.

---

## Week 4, Day 20 (cont.) — Task 89 — 2026-08-17

### Tasks Completed
- [x] Task 89 — Cross-repo comparison view

### Files Modified/Created
- `server/src/controllers/analyticsController.js` — new `compareRepos`: resolves the date range same as `getRepoAnalytics`, fetches all of the authenticated user's repos, and for each runs `getPrMetrics`/`getCommitMetrics` (existing) plus `calculateHealthScore` (imported from `aiService.js` — deterministic, no LLM call, always a fixed last-30-days window regardless of the requested range, same as the existing per-repo Health Score card) in parallel. Sorts repos by combined PR+commit activity descending. Cached under `analytics:compare:<userId>:<range>` (same TTL/pattern as other analytics endpoints).
- `server/src/routes/analytics.js` — `GET /api/analytics/compare?days=` (or `?startDate=&endDate=`), registered before `/:id` so it isn't swallowed by the UUID param route.
- `client/src/pages/ComparePage.jsx` / `ComparePage.css` (new) — table of all connected repos (reuses `.data-table` styling from `RepoDetailPage.css`) with columns: Health (color-coded green/amber/red, same thresholds as the existing Health Score card), PRs, Merge Rate, Avg Merge Time, Commits, Contributors, Lines Changed. Repo name links to its detail page. Reuses `DateRangePicker`.
- `client/src/App.jsx` / `client/src/components/Layout/Sidebar.jsx` — new `/compare` route and sidebar nav entry ("Compare", ⇄ icon) between Repositories and Reports.

### Tests Added
- None. Verified in-browser: table renders both seeded repos with correct health/PR/commit figures, repo-name link navigates to the right detail page, custom date range confirmed directly against the API (`GET /api/analytics/compare?startDate=2026-06-01&endDate=2026-08-17` → 200, correct per-repo counts), no console errors.

### Known Issues
- The compare view's Redis cache key (`analytics:compare:<userId>:*`) isn't cleared by `invalidateRepoCache` (which only clears `analytics:<repoId>:*`) — a sync completing won't immediately refresh the compare page's cache the way it does for the per-repo pages. Bounded by the existing 120s TTL, so treated as acceptable for now, consistent with the standing decision on the `redis.keys()` cache-invalidation known issue.
- Same carryover otherwise (100-row export cap).

### Next: Week 4, Task 90+
- Dark mode toggle — chosen and done later the same session (2026-08-17), see the Task 90 entry above.

---

## Week 4, Day 20 — 2026-08-17

### Tasks Completed
- [x] Task 88 — Contributor leaderboard widget

### Files Modified/Created
- `server/src/services/analyticsService.js` — new `getContributorLeaderboard(repositoryId, { since, until })`: queries PRs and commits in the range, groups by `authorLogin` into `{ login, prCount, mergedPrCount, commitCount, additions, deletions }`, sorts by `prCount + commitCount` descending, returns top 10. (Combining PR and commit lines in one total follows the same convention already used in `getContributorSummary`.)
- `server/src/controllers/analyticsController.js` — `getRepoAnalytics` now also calls `getContributorLeaderboard` and adds a `leaderboard` key to the response (same cache entry/TTL as the rest of the payload).
- `client/src/components/ContributorLeaderboard.jsx` (new) — ranked rows (🥇🥈🥉 for top 3, `#N` after that), each linking to the contributor detail page, showing PR count / commit count / lines changed.
- `client/src/pages/DashboardPage.jsx` / `RepoDetailPage.jsx` — new "Contributor Leaderboard" section added after the Commits section; replaces the old 5-item, commits-only "Top Contributors" list (which is now redundant — the leaderboard shows the same contributors ranked by combined PR+commit activity, with more detail). The `commitMetrics.topContributors` field is still returned by the API, just no longer rendered.
- `client/src/pages/DashboardPage.css` — new `.leaderboard`, `.leaderboard-row`, `.leaderboard-rank`, `.leaderboard-login`, `.leaderboard-stat`, `.leaderboard-lines` (shared by Dashboard and RepoDetail, same file the other widget styles already live in).

### Tests Added
- None. Verified in-browser (claude-in-chrome) on both Dashboard and RepoDetail pages against testuser/frontend-app: leaderboard renders with correct rank/PR/commit/line counts, row links to `/repos/:id/contributors/:login` and navigates correctly, no console errors.

### Known Issues
- Same carryover as Day 19 (`redis.keys()` cache invalidation, 100-row export cap).

### Next: Week 4, Task 89+
- Cross-repo comparison view — chosen and done later the same session (2026-08-17), see entry above.

---

## Week 4, Day 19 — 2026-08-12

### Tasks Completed
- [x] Task 83 — Retroactive webhook registration for pre-Task-71 repos
- [x] Task 84 — Weekly PR throughput chart, extracted shared `ActivityChart` component
- [x] Task 85 — Confirmation modal before disconnecting a repository
- [x] Task 86 — Repo quick-switcher in header
- [x] Task 87 — PR size breakdown widget on repo detail page

### Files Modified/Created
- `server/src/controllers/repoController.js` — extracted webhook-registration logic out of `connectRepo` into a shared `registerWebhookForRepo(user, repo)` helper; new `enableAutoSync` controller action lets a repo connected before Task 71 register a webhook on demand (404 if not found, 403 if not owned, 409 if already enabled, 400 if webhooks aren't configured server-side or the user has no GitHub token, 502 if GitHub registration fails).
- `server/src/routes/repos.js` — `POST /api/repos/:id/webhook` wired to `enableAutoSync`.
- `client/src/pages/ReposPage.jsx` / `.css` — repo cards without a webhook now show an "Enable auto-sync" button calling the new endpoint; swaps to the existing "⚡ Auto-sync" badge on success.
- `client/src/components/ActivityChart.jsx` (new) — extracted the existing daily-commits bar chart into `ActivityChart`, plus a new `ThroughputChart` (SVG line chart) for weekly merged-PR counts. Both replace duplicated inline chart markup in `DashboardPage.jsx`/`RepoDetailPage.jsx`.
- `server/src/services/analyticsService.js` — `getPrMetrics` gained a `sizeBreakdown` field: PRs bucketed into XS/S/M/L/XL by `additions + deletions` (≤10 / ≤50 / ≤200 / ≤500 / 500+ lines) via new `buildPrSizeBreakdown` helper.
- `client/src/components/PrSizeBreakdown.jsx` (new) — horizontal bar-per-bucket widget rendering `sizeBreakdown`, wired into `RepoDetailPage.jsx`.
- `client/src/components/ConfirmModal.jsx` / `.css` (new) — generic confirm/cancel modal; `ReposPage.jsx`'s disconnect button now opens it instead of disconnecting immediately.
- `client/src/components/Layout/Header.jsx` / `Layout.css` — new repo quick-switcher dropdown in the header for jumping between connected repos without going back to the Repos list.

### Tests Added
- None — manual verification only (no automated test suite yet in this project). Not re-verified in-browser this session; carried over from the original working session on 2026-08-12.

### Known Issues
- Same carryover as Day 17: `redis.keys()` cache invalidation pattern, export capped at 100 rows.

### Week 4 Day 19 Summary
Five tasks in one session: closed out the last Week 3 known issue (retroactive webhooks), added two new analytics visualizations (weekly PR throughput, PR size breakdown), and two UX polish items (disconnect confirmation, repo quick-switcher).

### Next: Week 4, Task 88+
- Contributor leaderboard widget (ranks contributors by PR/commit volume) — chosen at start of next session.

---

## Week 4, Day 18 — 2026-08-11

### Tasks Completed
- [x] Task 82 — Custom date-range picker for analytics (replaces fixed 7d/30d/90d presets)

### Files Modified/Created
- `server/src/services/analyticsService.js` — refactored from `days`-based (`getDaysAgo`) to `{ since, until }` date-range signatures across `getPrMetrics`, `getCommitMetrics`, `getContributorSummary`, `getPeriodComparison`, and the `buildDailyBuckets`/`buildWeeklyBuckets` helpers (now iterate the actual since→until span instead of assuming "now" as the end). `getPeriodComparison`'s previous-period window is `[since - (until-since), since)`.
- `server/src/controllers/analyticsController.js` — new `resolveRange(query)` parses `?days=N` (preset) or `?startDate=&endDate=` (custom, `YYYY-MM-DD`), clamps to `MAX_RANGE_DAYS = 365` and `until <= now`, 400s on invalid input. Cache key suffix changed from `:${days}` to `:${sinceISODate}:${untilISODate}`. Response now returns `startDate`/`endDate` instead of `days`.
- `client/src/components/DateRangePicker.jsx` (new) — exports `DateRangePicker`, `DEFAULT_RANGE`, `buildRangeQuery`; replaces the per-page preset tabs in Dashboard/RepoDetail/ContributorDetail with a shared component, adds a "Custom" toggle revealing two `<input type="date">` fields.
- `client/src/pages/DashboardPage.css` — shared styles: `.date-range-picker`, `.custom-range-inputs`, `.date-input`, `.date-range-sep`.
- `RepoDetailPage.jsx` export filename changed from `...-analytics-${days}d.json` to `...-analytics-${startDate}_to_${endDate}.json`.

### Bug Fixed Before Shipping
- Date inputs must not be controlled directly by the committed `range.startDate`/`range.endDate` — since the parent's `onChange`/refetch only fires once both dates are valid, a directly-controlled input snapped back to empty the instant only one date was set. Fixed with local `draftStart`/`draftEnd` state that holds each field independently; the parent only commits once both drafts are valid dates with start ≤ end.

### Tests Added
- None. Verified end-to-end in-browser (claude-in-chrome) on all 3 pages: preset↔custom toggle, draft-state fix, metrics/trends refetch correctly for a custom range, export filename, no console errors.

### Known Issues
- Same carryover as Day 17 (`redis.keys()` cache invalidation, retroactive webhooks — the latter fixed the next day in Task 83).

### Next: Week 4, Task 83+
- Retroactive webhook registration for pre-Task-71 repos (deferred from Day 17).

---

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

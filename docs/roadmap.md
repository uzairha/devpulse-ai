# Roadmap

Full 150-task roadmap approved and on file in conversation history.

## Summary

| Week | Days | Tasks | Focus |
|---|---|---|---|
| 1 | 1–5 | 1–25 | Foundation, DB, Auth, GitHub OAuth |
| 2 | 6–10 | 26–50 | GitHub sync, analytics API, dashboard |
| 3 | 11–15 | 51–75 | AI features, background jobs, security |
| 4 | 16–20 | 76–100 | Webhooks, UX polish, advanced analytics |
| 5 | 21–25 | 101–125 | Comprehensive testing |
| 6 | 26–30 | 126–150 | CI/CD, Docker, deployment, launch |

## Current Status

_See `docs/development-log.md` for the task-by-task log._

- [x] Week 1 (Tasks 1–25) — Foundation, DB, Auth, GitHub OAuth
- [x] Week 2 (Tasks 26–50) — GitHub sync, analytics API, dashboard
- [x] Week 3 (Tasks 51–75) — AI features, background jobs, security, webhooks, contributor view, Redis caching
- [x] Week 4 (Tasks 76–100) — Webhooks, UX polish, advanced analytics — complete (period trend deltas, search, MetricCard extraction, CSV export, custom date-range picker, retroactive webhooks, weekly PR throughput + ActivityChart, disconnect confirmation, repo quick-switcher, PR size breakdown, contributor leaderboard, cross-repo comparison view, dark mode toggle, activity heatmap, scheduled weekly reports, clickable notifications, stale PR widget, review turnaround metric, commit compliance tracker, repo activity sparkline, compare page metrics sync, seed reset mode)
- [x] Week 5 (Tasks 101–125) — Comprehensive testing — **complete 2026-09-03**. From no tests to **293 (146 server + 147 client)**. Vitest on both packages; a separate `devpulse_test` DB with truncate-between-tests + explicit factories + safety guards; `src/app.js` split from `src/index.js`. Server: integration tests for all six route groups (cross-user isolation asserted), both BullMQ workers, the analytics service (helpers + queries) and controller range parsing. Client: both contexts + hooks, the `api.js` interceptors, `ProtectedRoute`, every shared component, every page (data-fetching pages with `api` mocked at the module boundary). Two real bugs caught: `buildDailyBuckets` local-vs-UTC off-by-one, and the missing Web Storage polyfill under Node 26 / jsdom 30. See `docs/development-log.md` Week 5 Summary.
- [x] Week 6 (Tasks 121–125) — CI/CD, Docker, deployment, launch — **complete 2026-09-03**. CI/Docker/Terraform were delivered early by the AWS deployment-readiness milestone; Week 6 added the real README, `docs/LAUNCH.md` (launch runbook + rollback), a green full-stack smoke test (health/ready, login, repos, analytics, cache), and an `architecture.md` refresh. Final state: 293 tests green, lint clean, CI covering lint/test/build/Docker/Terraform, AWS deployment reviewed but unapplied. See `docs/development-log.md` Project Summary.
- [x] **AWS deployment-readiness milestone (Tasks 104–105)** — off-roadmap, run alongside Week 5. Production Dockerfiles and config hardening; ~2,100 lines of Terraform (VPC, ECS/Fargate, RDS, ElastiCache, S3, Secrets Manager, CloudWatch); CI + an inert OIDC-gated deploy workflow; security review, validation sweep and `docs/aws-deployment.md`. **Nothing has been applied — no AWS resources provisioned, none billed.** This front-loads much of what Week 6 was scoped to cover.

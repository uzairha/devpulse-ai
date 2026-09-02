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
- [ ] Week 5 (Tasks 101–125) — Comprehensive testing — in progress (Task 101: Vitest set up on client + server, first unit/component tests; Task 102: integration test infrastructure — `devpulse_test` database, truncate-between-tests, factories, supertest, first route suite on auth; Task 103: repository route integration tests; Task 106: analytics, notifications, AI and webhook route integration tests — 121 server tests passing; Task 107: BullMQ worker consumption tests (`syncWorker`/`reportWorker`) plus the first client data-fetching/effect tests (`AuthContext`/`useAuth`); Task 108: page-level tests for LoginPage and RegisterPage; Task 109: `services/api.js` interceptor tests; Task 110: ProtectedRoute and ErrorBoundary tests; Tasks 111–113: RepoTables, presentational widgets and DateRangePicker interaction tests — **133 server + 84 client tests passing** as of 2026-09-02, see development-log)
- [ ] Week 6 (Tasks 126–150) — CI/CD, Docker, deployment, launch
- [x] **AWS deployment-readiness milestone (Tasks 104–105)** — off-roadmap, run alongside Week 5. Production Dockerfiles and config hardening; ~2,100 lines of Terraform (VPC, ECS/Fargate, RDS, ElastiCache, S3, Secrets Manager, CloudWatch); CI + an inert OIDC-gated deploy workflow; security review, validation sweep and `docs/aws-deployment.md`. **Nothing has been applied — no AWS resources provisioned, none billed.** This front-loads much of what Week 6 was scoped to cover.

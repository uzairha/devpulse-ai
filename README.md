# DevPulse AI

> AI-powered developer analytics. Connect your GitHub repositories and get insight into PR health, review turnaround, commit patterns, and weekly engineering trends — with an AI assistant that can answer questions about your repo data.

Built over 30 days as a portfolio project. ~293 automated tests, a full CI pipeline, and production infrastructure-as-code (not provisioned — see [Deployment](#deployment)).

---

## Features

| Area | What it does |
|---|---|
| **Auth** | Email/password (bcrypt + JWT, 7-day expiry) and one-click GitHub OAuth |
| **Repositories** | Connect any GitHub repo, manual + webhook-triggered sync, per-repo auto-sync toggle |
| **PR analytics** | Merge rate, avg time to merge, review turnaround, weekly throughput, size breakdown, stale-PR list |
| **Commit analytics** | Frequency, contributors, day/hour activity heatmap, Conventional Commits compliance, message-type breakdown |
| **Comparisons** | Period-over-period trend deltas; cross-repo side-by-side view |
| **AI** | PR summaries, weekly engineering reports (auto-generated Mondays), 0–100 repo health score, chat over your repo data (gpt-4o-mini) |
| **Notifications** | In-app center with clickable, deep-linked notifications for sync results and new reports |
| **UX** | Light/dark theme, custom date ranges, CSV/JSON export, repo quick-switcher |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6, Axios |
| Backend | Node.js + Express |
| Database | PostgreSQL 15 via Prisma 5 |
| Background jobs | BullMQ on Redis |
| Caching | Redis (same instance) |
| AI | OpenAI API (gpt-4o-mini) |
| GitHub | `@octokit/rest` + OAuth + push webhooks |
| Tests | Vitest (both packages), Testing Library, Supertest |
| CI | GitHub Actions |
| IaC | Terraform (AWS ECS/Fargate, RDS, ElastiCache, S3, Secrets Manager) |

---

## Quick start (local)

Prerequisites: Node 20+, Docker.

```bash
# 1. Infrastructure
docker compose up -d                       # Postgres + Redis

# 2. Backend
cd server
cp .env.example .env                        # fill in GITHUB_* and OPENAI_API_KEY
npx prisma migrate dev                      # create schema
npm run seed                                # optional: demo data (test@devpulse.ai / password123)
npm run dev                                 # http://localhost:3001

# 3. Frontend (new terminal)
cd client
npm install
npm run dev                                 # http://localhost:5173
```

GitHub OAuth needs an OAuth app (github.com/settings/developers) with callback
`http://localhost:3001/api/auth/github/callback`. Repo **sync** needs a real
GitHub access token, obtained by signing in with GitHub. Webhook delivery in dev
needs a public tunnel (e.g. ngrok) set as `WEBHOOK_BASE_URL`.

### Everything in Docker

```bash
docker compose --profile full up --build    # db, redis, migrate, server, worker, client
```

The `full` profile serves the app and API same-origin through nginx on
`http://localhost:8080`.

---

## Tests

```bash
docker compose up -d

cd server
cp .env.test.example .env.test
docker compose exec db psql -U postgres -c "CREATE DATABASE devpulse_test;"
npm run test:db:migrate
npm test                                     # ~146 integration + unit tests

cd ../client && npm test                     # ~147 component + page tests
```

The server suite truncates its database between tests, so it refuses to start
unless `DATABASE_URL` names a `*_test` database and `REDIS_URL` uses a non-zero
logical database. CI (`.github/workflows/ci.yml`) runs both suites, the client
production build, both Docker image builds, and `terraform fmt`/`validate` on
every push and PR.

---

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [API Design](docs/api-design.md)
- [AWS Deployment](docs/aws-deployment.md) · [Launch Checklist](docs/LAUNCH.md)
- [Roadmap](docs/roadmap.md) · [Development Log](docs/development-log.md)

---

## Deployment

`infrastructure/aws/terraform/` describes a complete AWS deployment — VPC, ECS
Fargate (backend, frontend, worker), RDS Postgres, ElastiCache Redis, S3,
Secrets Manager, CloudWatch — and `.github/workflows/deploy-aws.yml` describes
the pipeline that would ship to it.

**Neither has ever been run, and nothing in this repository will run them for
you.** No AWS resources have been provisioned and none are being billed. The
configuration is written to be read and reviewed, not applied:

- There is no Terraform state and no remote backend; `terraform apply` has never
  been run.
- The deploy workflow is gated on a repository variable (`AWS_DEPLOY_ENABLED`)
  that does not exist and authenticates via OIDC against a role that does not
  exist. No AWS credentials are stored in this repository.
- CI runs `terraform fmt`/`validate` only, with `-backend=false` and no
  credentials.

Applying it for real costs money — see the cost notes in
[docs/aws-deployment.md](docs/aws-deployment.md) first.

# Architecture

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite | Port 5173 in dev |
| Backend | Node.js + Express | Port 3001 in dev |
| Database | PostgreSQL 15 | Managed via Prisma ORM |
| ORM | Prisma 5 | Migrations in `server/prisma/migrations/` |
| Auth | JWT + GitHub OAuth | 7-day token expiry |
| AI | OpenAI API (gpt-4o-mini) | Week 3 |
| Background Jobs | BullMQ + Redis | Week 2 |
| Caching | Redis | Same instance as BullMQ |
| Containerization | Docker + Docker Compose | Local dev; production images per service |
| Tests | Vitest + Testing Library + Supertest | ~293 tests; run in CI |
| CI | GitHub Actions | `ci.yml` — lint + test both packages, client build, Docker builds, Terraform validate |
| IaC | Terraform | `infrastructure/aws/terraform/` — reviewed, not applied |
| Deployment target | AWS ECS/Fargate + RDS + ElastiCache + ALB | Described in `docs/aws-deployment.md`; no resources provisioned |

## Repository Structure

```
devpulse-ai/
├── client/                   # React + Vite frontend
│   └── src/
│       ├── components/       # Reusable UI components (+ Layout/ shell)
│       ├── context/          # AuthContext, ThemeContext
│       ├── hooks/            # useAuth, useTheme
│       ├── pages/            # Route-level page components
│       ├── services/         # api.js (axios instance)
│       └── test/             # Vitest setup
├── server/                   # Express API backend
│   └── src/
│       ├── app.js            # configured Express app (importable, no listen)
│       ├── index.js          # entrypoint: app + workers + cron
│       ├── config/           # environment config module
│       ├── controllers/      # request handlers
│       ├── lib/              # prisma, redis, queue, openai, cache, logger
│       ├── middleware/       # requireAuth, validate, errorHandler
│       ├── routes/           # auth, repos, analytics, ai, notifications, webhooks, health
│       ├── services/         # auth, githubOAuth, githubApi, analytics, ai, notification
│       ├── workers/          # syncWorker, reportWorker (BullMQ)
│       └── test/             # test-DB setup + factories
├── infrastructure/aws/terraform/   # VPC, ECS, RDS, ElastiCache, S3, Secrets Manager
├── docs/                     # project documentation
├── .github/workflows/        # ci.yml, deploy-aws.yml (inert)
└── docker-compose.yml        # local Postgres + Redis; "full" profile runs everything
```

## Authentication Flow

### Email/Password
1. Client sends `POST /api/auth/register` or `/login`
2. Server validates, hashes password with bcrypt (cost 12)
3. Returns signed JWT (7-day expiry)
4. Client stores token in localStorage
5. All subsequent requests include `Authorization: Bearer <token>`

### GitHub OAuth
1. Client navigates to `/api/auth/github`
2. Server redirects to GitHub consent page
3. GitHub redirects back to `/api/auth/github/callback?code=...`
4. Server exchanges code for access token
5. Server fetches GitHub user profile
6. Server creates or updates User record
7. Server redirects to `CLIENT_URL/auth/callback?token=<jwt>`
8. Client reads token from URL, stores in localStorage

## Error Handling

- All route errors flow to the global `errorHandler` middleware
- Expected errors use `err.statusCode` to set HTTP status
- Unexpected errors (500s) log full stack trace via Winston
- In production: 500 responses return generic message (no stack traces)

## Database

See `docs/database-schema.md` for full table definitions.

- 5 tables: User, Repository, SyncJob, PullRequest, Commit
- All primary keys are UUIDs
- Cascade deletes: Repository → SyncJob, PullRequest, Commit
- Indexes on date columns used in analytics queries

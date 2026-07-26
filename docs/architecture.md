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
| Containerization | Docker + Docker Compose | Local dev infrastructure |
| CI/CD | GitHub Actions | Week 6 |
| Deployment | Render (API) + Vercel (UI) | Week 6 |

## Repository Structure

```
devpulse-ai/
├── client/                   # React + Vite frontend
│   └── src/
│       ├── components/       # Reusable UI components
│       │   └── Layout/       # Sidebar, Header, Layout shell
│       ├── context/          # AuthContext
│       ├── hooks/            # useAuth
│       ├── pages/            # Route-level page components
│       └── services/         # api.js (axios instance)
├── server/                   # Express API backend
│   └── src/
│       ├── config/           # Environment config module
│       ├── controllers/      # Request handlers
│       ├── lib/              # prisma.js, logger.js
│       ├── middleware/       # requireAuth, validate, errorHandler
│       ├── routes/           # auth.js, health.js
│       └── services/         # authService, githubOAuthService
├── docs/                     # Project documentation
├── .github/workflows/        # CI/CD (Week 6)
└── docker-compose.yml        # Local Postgres + Redis
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

# Architecture

_Updated continuously throughout development._

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + GitHub OAuth |
| AI | OpenAI API (gpt-4o-mini) |
| Background Jobs | BullMQ + Redis |
| Caching | Redis |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Deployment | Render (API) + Vercel (UI) |

## Repository Structure

```
devpulse-ai/
├── client/          # React + Vite frontend (port 5173)
├── server/          # Express API backend (port 3001)
├── docs/            # Project documentation
├── .github/         # GitHub Actions workflows
├── docker-compose.yml
├── .gitignore
└── README.md
```

_Architecture details added as each component is built._

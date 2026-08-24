# DevPulse AI

> AI-powered developer analytics platform. Connect your GitHub repositories and get intelligent insights into your team's engineering velocity, PR health, and code review patterns.

**Live Demo:** _coming soon_

---

## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [API Design](docs/api-design.md)
- [Roadmap](docs/roadmap.md)
- [Development Log](docs/development-log.md)

---

## Running tests

```bash
docker compose up -d                 # Postgres + Redis must be running

cd server
cp .env.test.example .env.test
docker compose exec db psql -U postgres -c "CREATE DATABASE devpulse_test;"
npm run test:db:migrate              # apply migrations to devpulse_test
npm test

cd ../client && npm test
```

The server suite truncates its database between tests, so it refuses to start
unless `DATABASE_URL` names a database ending in `_test` and `REDIS_URL` points at
a non-zero Redis logical database.

---

_Full README coming in Week 6._

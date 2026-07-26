# Development Log

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

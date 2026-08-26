import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { default as app } from '../app.js';
import {
  createAuthedUser,
  createRepository,
  createPullRequest,
  createCommit,
} from '../test/factories.js';

describe('GET /api/analytics/:id', () => {
  it('returns the full analytics payload for the owning user', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await createPullRequest(repo.id, { state: 'open' });
    await createCommit(repo.id);

    const res = await request(app).get(`/api/analytics/${repo.id}`).set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.repo.id).toBe(repo.id);
    expect(res.body).toHaveProperty('prMetrics');
    expect(res.body).toHaveProperty('commitMetrics');
    expect(res.body).toHaveProperty('trends');
    expect(res.body).toHaveProperty('leaderboard');
    expect(res.body).toHaveProperty('activityHeatmap');
    expect(res.body).toHaveProperty('stalePrs');
  });

  it('rejects a request for a repo owned by another user with 403 and no leak', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app).get(`/api/analytics/${theirRepo.id}`).set('Authorization', authHeader);

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('prMetrics');
  });

  it('returns 404 for a repository that does not exist', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app)
      .get('/api/analytics/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('rejects a malformed repository id with 400 before touching the database', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app).get('/api/analytics/not-a-uuid').set('Authorization', authHeader);

    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range days value', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app)
      .get(`/api/analytics/${repo.id}?days=9999`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { user } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app).get(`/api/analytics/${repo.id}`);

    expect(res.status).toBe(401);
  });

  it('serves the second request for the same range from cache', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await createPullRequest(repo.id);

    const first = await request(app).get(`/api/analytics/${repo.id}?days=30`).set('Authorization', authHeader);
    // A PR added after the first (cached) response should not appear in the
    // second response if the cache is actually being served.
    await createPullRequest(repo.id);
    const second = await request(app).get(`/api/analytics/${repo.id}?days=30`).set('Authorization', authHeader);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });
});

describe('GET /api/analytics/compare', () => {
  it('returns only the calling user’s repos, sorted by activity', async () => {
    const { user, authHeader } = await createAuthedUser();
    const other = await createAuthedUser();

    const quiet = await createRepository(user.id, { fullName: 'me/quiet' });
    const busy = await createRepository(user.id, { fullName: 'me/busy' });
    await createPullRequest(busy.id);
    await createPullRequest(busy.id);
    await createRepository(other.user.id, { fullName: 'them/theirs' });

    const res = await request(app).get('/api/analytics/compare').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(2);
    const ids = res.body.repos.map((r) => r.repo.id);
    expect(ids).toContain(quiet.id);
    expect(ids).toContain(busy.id);
    expect(ids).not.toContain(undefined);
    // busy repo (2 PRs) should sort ahead of the quiet one (0 PRs)
    expect(res.body.repos[0].repo.id).toBe(busy.id);
  });

  it('returns an empty list for a user with no repos, not an error', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app).get('/api/analytics/compare').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.repos).toEqual([]);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/analytics/compare');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/analytics/:id/prs', () => {
  it('paginates and filters by state', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await createPullRequest(repo.id, { state: 'open' });
    await createPullRequest(repo.id, { state: 'closed' });
    await createPullRequest(repo.id, { state: 'closed', mergedAt: new Date() });

    const openOnly = await request(app)
      .get(`/api/analytics/${repo.id}/prs?state=open`)
      .set('Authorization', authHeader);
    expect(openOnly.status).toBe(200);
    expect(openOnly.body.total).toBe(1);

    const mergedOnly = await request(app)
      .get(`/api/analytics/${repo.id}/prs?state=merged`)
      .set('Authorization', authHeader);
    expect(mergedOnly.body.total).toBe(1);

    const paged = await request(app)
      .get(`/api/analytics/${repo.id}/prs?limit=1&page=1`)
      .set('Authorization', authHeader);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.pages).toBe(3);
  });

  it('rejects a repo owned by another user with 403', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .get(`/api/analytics/${theirRepo.id}/prs`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });

  it('rejects a limit above MAX_TABLE_LIMIT with 400', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app)
      .get(`/api/analytics/${repo.id}/prs?limit=1000`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/analytics/:id/commits', () => {
  it('filters by author', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await createCommit(repo.id, { authorLogin: 'alice' });
    await createCommit(repo.id, { authorLogin: 'bob' });

    const res = await request(app)
      .get(`/api/analytics/${repo.id}/commits?author=alice`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].authorLogin).toBe('alice');
  });

  it('rejects a repo owned by another user with 403', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .get(`/api/analytics/${theirRepo.id}/commits`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/analytics/:id/contributors/:login', () => {
  it('returns a summary for a contributor with activity', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    // The default query range is the last 30 days from now, so activity has to
    // be recent — the factories' own default createdAt (2026-01-01) predates
    // that window and would fall outside it.
    await createPullRequest(repo.id, { authorLogin: 'alice', createdAt: new Date() });
    await createCommit(repo.id, { authorLogin: 'alice', committedAt: new Date() });

    const res = await request(app)
      .get(`/api/analytics/${repo.id}/contributors/alice`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('alice');
    expect(res.body).toHaveProperty('trends');
  });

  it('returns 404 for a contributor with no activity in range', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app)
      .get(`/api/analytics/${repo.id}/contributors/nobody`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('rejects a repo owned by another user with 403 before leaking contributor data', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);
    await createPullRequest(theirRepo.id, { authorLogin: 'alice' });

    const res = await request(app)
      .get(`/api/analytics/${theirRepo.id}/contributors/alice`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });
});

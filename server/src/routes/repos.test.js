import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Only the GitHub client is mocked: outbound HTTP must never fire from a test.
// BullMQ is deliberately left real — it runs against the test Redis database,
// which setup.js flushes between tests, so the actual enqueue path stays covered
// rather than being asserted against a stub.
vi.mock('../services/githubApiService.js', () => ({
  getUserRepos: vi.fn(),
  getRepoPullRequests: vi.fn(),
  getRepoCommits: vi.fn(),
  getPrReviews: vi.fn(),
  createRepoWebhook: vi.fn(),
  deleteRepoWebhook: vi.fn(),
}));

const { getUserRepos, createRepoWebhook, deleteRepoWebhook } = await import(
  '../services/githubApiService.js'
);
const { default: app } = await import('../app.js');
const { default: prisma } = await import('../lib/prisma.js');
const { syncQueue } = await import('../lib/queue.js');
const { createAuthedUser, createRepository, createCommit } = await import('../test/factories.js');

const githubRepo = (overrides = {}) => ({
  id: 555001,
  name: 'demo',
  full_name: 'testuser/demo',
  description: 'A demo repo',
  language: 'TypeScript',
  private: false,
  stargazers_count: 7,
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/repos', () => {
  it('returns only the calling user’s repositories', async () => {
    const { user, authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const mine = await createRepository(user.id, { name: 'mine' });
    await createRepository(other.user.id, { name: 'theirs' });

    const res = await request(app).get('/api/repos').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(mine.id);
  });

  it('includes the activity sparkline for each repo', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await createCommit(repo.id, { committedAt: new Date() });

    const res = await request(app).get('/api/repos').set('Authorization', authHeader);

    // 15, not 14: SPARKLINE_DAYS is 14, but buildDailyBuckets is inclusive at
    // both ends, so the series spans day -14 through today. Pinned here as the
    // actual behaviour — the count is stable, this is a naming mismatch rather
    // than a defect, and changing it would alter the rendered chart.
    expect(res.body[0].activitySparkline).toHaveLength(15);
    expect(res.body[0]).toHaveProperty('lastActivityAt');
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/repos');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/repos/available', () => {
  it('returns an empty list when the user has no GitHub token', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app).get('/api/repos/available').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(getUserRepos).not.toHaveBeenCalled();
  });

  it('omits repositories that are already connected', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    await createRepository(user.id, { githubId: 555001 });
    getUserRepos.mockResolvedValue([githubRepo({ id: 555001 }), githubRepo({ id: 555002, name: 'other' })]);

    const res = await request(app).get('/api/repos/available').set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].githubId).toBe(555002);
  });
});

describe('POST /api/repos', () => {
  it('connects a repo, queues a sync, and registers a webhook', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    getUserRepos.mockResolvedValue([githubRepo()]);
    createRepoWebhook.mockResolvedValue(98765);

    const res = await request(app)
      .post('/api/repos')
      .set('Authorization', authHeader)
      .send({ githubRepoId: 555001 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fullName: 'testuser/demo', webhookId: 98765 });

    const stored = await prisma.repository.findUnique({ where: { githubId: 555001 } });
    expect(stored.userId).toBe(user.id);

    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(1);
  });

  it('still connects the repo when webhook registration fails', async () => {
    const { authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    getUserRepos.mockResolvedValue([githubRepo()]);
    createRepoWebhook.mockRejectedValue(new Error('GitHub said no'));

    const res = await request(app)
      .post('/api/repos')
      .set('Authorization', authHeader)
      .send({ githubRepoId: 555001 });

    expect(res.status).toBe(201);
    expect(res.body.webhookId).toBeNull();
  });

  it('rejects connecting without a linked GitHub account with 400', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app)
      .post('/api/repos')
      .set('Authorization', authHeader)
      .send({ githubRepoId: 555001 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('GitHub account not connected');
  });

  it('returns 404 when the repo is not in the user’s GitHub account', async () => {
    const { authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    getUserRepos.mockResolvedValue([githubRepo({ id: 999999 })]);

    const res = await request(app)
      .post('/api/repos')
      .set('Authorization', authHeader)
      .send({ githubRepoId: 555001 });

    expect(res.status).toBe(404);
  });

  it('rejects a duplicate connection with 409', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    await createRepository(user.id, { githubId: 555001 });
    getUserRepos.mockResolvedValue([githubRepo({ id: 555001 })]);

    const res = await request(app)
      .post('/api/repos')
      .set('Authorization', authHeader)
      .send({ githubRepoId: 555001 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Repository already connected');
  });

  it('rejects a non-integer githubRepoId with 400', async () => {
    const { authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });

    const res = await request(app)
      .post('/api/repos')
      .set('Authorization', authHeader)
      .send({ githubRepoId: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(getUserRepos).not.toHaveBeenCalled();
  });
});

describe('POST /api/repos/:id/sync', () => {
  it('queues a sync job', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app).post(`/api/repos/${repo.id}/sync`).set('Authorization', authHeader);

    expect(res.status).toBe(202);
    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(1);
  });

  it('refuses to queue a second sync while one is running', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await prisma.syncJob.create({ data: { repositoryId: repo.id, status: 'running' } });

    const res = await request(app).post(`/api/repos/${repo.id}/sync`).set('Authorization', authHeader);

    expect(res.status).toBe(409);
    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(0);
  });

  it('will not sync another user’s repository', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .post(`/api/repos/${theirRepo.id}/sync`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(0);
  });

  it('returns 404 for an unknown repository', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app)
      .post('/api/repos/11111111-1111-4111-8111-111111111111/sync')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('rejects a non-UUID id with 400', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app).post('/api/repos/not-a-uuid/sync').set('Authorization', authHeader);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/repos/:id/sync-status', () => {
  it('returns the most recent sync job', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await prisma.syncJob.create({
      data: { repositoryId: repo.id, status: 'completed', createdAt: new Date('2026-01-01Z') },
    });
    const newest = await prisma.syncJob.create({
      data: { repositoryId: repo.id, status: 'failed', error: 'boom', createdAt: new Date('2026-02-01Z') },
    });

    const res = await request(app)
      .get(`/api/repos/${repo.id}/sync-status`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.latestJob).toMatchObject({ id: newest.id, status: 'failed', error: 'boom' });
  });

  it('returns a null job when the repo has never synced', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app)
      .get(`/api/repos/${repo.id}/sync-status`)
      .set('Authorization', authHeader);

    expect(res.body.latestJob).toBeNull();
  });

  it('will not expose another user’s sync status', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .get(`/api/repos/${theirRepo.id}/sync-status`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/repos/:id', () => {
  it('deletes the repo and its dependent rows', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await createCommit(repo.id);

    const res = await request(app).delete(`/api/repos/${repo.id}`).set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(await prisma.repository.findUnique({ where: { id: repo.id } })).toBeNull();
    expect(await prisma.commit.count({ where: { repositoryId: repo.id } })).toBe(0);
  });

  it('removes the GitHub webhook when one is registered', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id, { webhookId: 4242 });
    deleteRepoWebhook.mockResolvedValue(undefined);

    await request(app).delete(`/api/repos/${repo.id}`).set('Authorization', authHeader);

    expect(deleteRepoWebhook).toHaveBeenCalledWith('gh-token', 'testuser', repo.name, 4242);
  });

  it('still deletes the repo when webhook removal fails', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id, { webhookId: 4242 });
    deleteRepoWebhook.mockRejectedValue(new Error('GitHub said no'));

    const res = await request(app).delete(`/api/repos/${repo.id}`).set('Authorization', authHeader);

    expect(res.status).toBe(204);
    expect(await prisma.repository.findUnique({ where: { id: repo.id } })).toBeNull();
  });

  it('will not delete another user’s repository', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .delete(`/api/repos/${theirRepo.id}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
    expect(await prisma.repository.findUnique({ where: { id: theirRepo.id } })).not.toBeNull();
  });
});

describe('POST /api/repos/:id/webhook', () => {
  it('registers a webhook and stores its id', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id);
    createRepoWebhook.mockResolvedValue(31337);

    const res = await request(app)
      .post(`/api/repos/${repo.id}/webhook`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.webhookId).toBe(31337);
  });

  it('rejects enabling auto-sync twice with 409', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id, { webhookId: 1 });

    const res = await request(app)
      .post(`/api/repos/${repo.id}/webhook`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(409);
    expect(createRepoWebhook).not.toHaveBeenCalled();
  });

  it('returns 502 when GitHub rejects the webhook registration', async () => {
    const { user, authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id);
    createRepoWebhook.mockRejectedValue(new Error('GitHub said no'));

    const res = await request(app)
      .post(`/api/repos/${repo.id}/webhook`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(502);
  });

  it('will not enable auto-sync on another user’s repository', async () => {
    const { authHeader } = await createAuthedUser({ githubAccessToken: 'gh-token' });
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .post(`/api/repos/${theirRepo.id}/webhook`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
    expect(createRepoWebhook).not.toHaveBeenCalled();
  });
});

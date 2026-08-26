import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Only the OpenAI boundary is mocked, same policy as githubApiService in
// repos.test.js: outbound HTTP must never fire from a test. calculateHealthScore
// is deliberately excluded from that boundary — it is pure arithmetic over
// PR/commit rows with no LLM call at all, so it needs no mock and stays covered
// end to end.
vi.mock('../lib/openai.js', () => ({
  chat: vi.fn(),
}));

const { chat } = await import('../lib/openai.js');
const { default: app } = await import('../app.js');
const { default: prisma } = await import('../lib/prisma.js');
const {
  createAuthedUser,
  createRepository,
  createPullRequest,
  createCommit,
} = await import('../test/factories.js');

beforeEach(() => {
  vi.clearAllMocks();
  chat.mockResolvedValue('Mocked AI response.');
});

describe('POST /api/ai/pr-summary', () => {
  it('summarizes a PR the calling user owns', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    const pr = await createPullRequest(repo.id);

    const res = await request(app)
      .post('/api/ai/pr-summary')
      .set('Authorization', authHeader)
      .send({ prId: pr.id });

    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Mocked AI response.');
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('rejects a PR belonging to another user’s repo with 403', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);
    const theirPr = await createPullRequest(theirRepo.id);

    const res = await request(app)
      .post('/api/ai/pr-summary')
      .set('Authorization', authHeader)
      .send({ prId: theirPr.id });

    expect(res.status).toBe(403);
    expect(chat).not.toHaveBeenCalled();
  });

  it('returns 404 for a prId that does not exist', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app)
      .post('/api/ai/pr-summary')
      .set('Authorization', authHeader)
      .send({ prId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('rejects a non-UUID prId with 400 before touching the database', async () => {
    const { authHeader } = await createAuthedUser();

    const res = await request(app)
      .post('/api/ai/pr-summary')
      .set('Authorization', authHeader)
      .send({ prId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(chat).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).post('/api/ai/pr-summary').send({ prId: 'irrelevant' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/ai/health-score/:id', () => {
  it('computes a score with no LLM call', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await createPullRequest(repo.id, { mergedAt: new Date() });
    await createCommit(repo.id);

    const res = await request(app)
      .get(`/api/ai/health-score/${repo.id}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(typeof res.body.score).toBe('number');
    expect(res.body).toHaveProperty('breakdown');
    expect(chat).not.toHaveBeenCalled();
  });

  it('rejects a repo owned by another user with 403', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .get(`/api/ai/health-score/${theirRepo.id}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/ai/weekly-report/:id', () => {
  it('generates and persists a report for the owning user', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app)
      .post(`/api/ai/weekly-report/${repo.id}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.report).toBe('Mocked AI response.');
    expect(res.body.repoFullName).toBe(repo.fullName);

    const saved = await prisma.weeklyReport.findMany({ where: { repositoryId: repo.id } });
    expect(saved).toHaveLength(1);
    expect(saved[0].content).toBe('Mocked AI response.');
  });

  it('rejects a repo owned by another user with 403 and persists nothing', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .post(`/api/ai/weekly-report/${theirRepo.id}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
    const saved = await prisma.weeklyReport.findMany({ where: { repositoryId: theirRepo.id } });
    expect(saved).toHaveLength(0);
  });
});

describe('GET /api/ai/weekly-report/:id/history', () => {
  it('returns previously generated reports for the owning user, newest first', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);
    await prisma.weeklyReport.create({
      data: {
        repositoryId: repo.id,
        content: 'older',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-08'),
        createdAt: new Date('2026-01-08'),
      },
    });
    await prisma.weeklyReport.create({
      data: {
        repositoryId: repo.id,
        content: 'newer',
        periodStart: new Date('2026-01-08'),
        periodEnd: new Date('2026-01-15'),
        createdAt: new Date('2026-01-15'),
      },
    });

    const res = await request(app)
      .get(`/api/ai/weekly-report/${repo.id}/history`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].content).toBe('newer');
  });

  it('rejects a repo owned by another user with 403', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .get(`/api/ai/weekly-report/${theirRepo.id}/history`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/ai/chat/:id', () => {
  it('replies for the owning user', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app)
      .post(`/api/ai/chat/${repo.id}`)
      .set('Authorization', authHeader)
      .send({ message: 'How is this repo doing?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Mocked AI response.');
  });

  it('rejects an empty message with 400', async () => {
    const { user, authHeader } = await createAuthedUser();
    const repo = await createRepository(user.id);

    const res = await request(app)
      .post(`/api/ai/chat/${repo.id}`)
      .set('Authorization', authHeader)
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(chat).not.toHaveBeenCalled();
  });

  it('rejects a repo owned by another user with 403', async () => {
    const { authHeader } = await createAuthedUser();
    const other = await createAuthedUser();
    const theirRepo = await createRepository(other.user.id);

    const res = await request(app)
      .post(`/api/ai/chat/${theirRepo.id}`)
      .set('Authorization', authHeader)
      .send({ message: 'hi' });

    expect(res.status).toBe(403);
  });
});

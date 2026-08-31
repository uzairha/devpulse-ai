import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same mocking policy as repos.test.js: only the GitHub client is mocked,
// outbound HTTP must never fire from a test. This suite drives the worker's
// job processor directly rather than running a real BullMQ Worker consumer —
// enqueueing is already covered end-to-end in repos.test.js/webhooks.test.js,
// so this is the deliberate "consumption end" counterpart: call processSync
// with a fake job object and assert on what it actually wrote.
vi.mock('../services/githubApiService.js', () => ({
  getRepoPullRequests: vi.fn(),
  getRepoCommits: vi.fn(),
  getPrReviews: vi.fn(),
}));

const { getRepoPullRequests, getRepoCommits, getPrReviews } = await import(
  '../services/githubApiService.js'
);
const { processSync } = await import('./syncWorker.js');
const { default: prisma } = await import('../lib/prisma.js');
const { createUser, createRepository, createPullRequest } = await import('../test/factories.js');

const githubPr = (overrides = {}) => ({
  id: 700001,
  number: 1,
  title: 'Add feature',
  state: 'open',
  user: { login: 'octocat', avatar_url: 'https://example.com/a.png' },
  created_at: '2026-02-01T00:00:00Z',
  closed_at: null,
  merged_at: null,
  additions: 10,
  deletions: 2,
  changed_files: 3,
  review_comments: 1,
  comments: 0,
  ...overrides,
});

const githubCommit = (overrides = {}) => ({
  sha: 'a'.repeat(40),
  commit: {
    message: 'feat: do a thing',
    author: { date: '2026-02-01T00:00:00Z', email: 'octocat@example.com' },
  },
  author: { login: 'octocat' },
  stats: { additions: 5, deletions: 1 },
  ...overrides,
});

const githubReview = (overrides = {}) => ({ submitted_at: '2026-02-01T02:00:00Z', ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  getRepoPullRequests.mockResolvedValue([]);
  getRepoCommits.mockResolvedValue([]);
  getPrReviews.mockResolvedValue([]);
});

describe('processSync', () => {
  it('imports PRs and commits and marks the sync job completed', async () => {
    const user = await createUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id, { fullName: 'testuser/demo' });
    getRepoPullRequests.mockResolvedValue([githubPr()]);
    getRepoCommits.mockResolvedValue([githubCommit()]);
    getPrReviews.mockResolvedValue([githubReview()]);

    await processSync({ data: { repositoryId: repo.id } });

    const jobs = await prisma.syncJob.findMany({ where: { repositoryId: repo.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('completed');

    const pr = await prisma.pullRequest.findUnique({
      where: { repositoryId_githubPrId: { repositoryId: repo.id, githubPrId: 700001 } },
    });
    expect(pr).toMatchObject({ title: 'Add feature', authorLogin: 'octocat' });
    expect(pr.firstReviewAt).toEqual(new Date('2026-02-01T02:00:00Z'));

    const commit = await prisma.commit.findUnique({ where: { sha: 'a'.repeat(40) } });
    expect(commit).toMatchObject({ authorLogin: 'octocat', message: 'feat: do a thing' });

    const updated = await prisma.repository.findUnique({ where: { id: repo.id } });
    expect(updated.lastSyncAt).not.toBeNull();
  });

  it('notifies the owner on success when syncNotifications is enabled', async () => {
    const user = await createUser({ githubAccessToken: 'gh-token', syncNotifications: true });
    const repo = await createRepository(user.id);

    await processSync({ data: { repositoryId: repo.id } });

    const notifs = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({ type: 'sync_complete', link: `/repos/${repo.id}` });
  });

  it('does not notify the owner when syncNotifications is disabled', async () => {
    const user = await createUser({ githubAccessToken: 'gh-token', syncNotifications: false });
    const repo = await createRepository(user.id);

    await processSync({ data: { repositoryId: repo.id } });

    const notifs = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notifs).toHaveLength(0);
  });

  it('skips fetching reviews for a PR that already has a firstReviewAt', async () => {
    const user = await createUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id);
    const existing = new Date('2026-01-15T00:00:00Z');
    await createPullRequest(repo.id, { githubPrId: 700001, firstReviewAt: existing });
    getRepoPullRequests.mockResolvedValue([githubPr({ id: 700001 })]);

    await processSync({ data: { repositoryId: repo.id } });

    expect(getPrReviews).not.toHaveBeenCalled();
    const pr = await prisma.pullRequest.findUnique({
      where: { repositoryId_githubPrId: { repositoryId: repo.id, githubPrId: 700001 } },
    });
    expect(pr.firstReviewAt).toEqual(existing);
  });

  it('sets firstReviewAt to null and keeps syncing when a single PR’s review fetch fails', async () => {
    const user = await createUser({ githubAccessToken: 'gh-token' });
    const repo = await createRepository(user.id);
    getRepoPullRequests.mockResolvedValue([githubPr()]);
    getPrReviews.mockRejectedValue(new Error('GitHub said no'));

    await processSync({ data: { repositoryId: repo.id } });

    const pr = await prisma.pullRequest.findUnique({
      where: { repositoryId_githubPrId: { repositoryId: repo.id, githubPrId: 700001 } },
    });
    expect(pr.firstReviewAt).toBeNull();
    const jobs = await prisma.syncJob.findMany({ where: { repositoryId: repo.id } });
    expect(jobs[0].status).toBe('completed');
  });

  it('marks the sync job failed and notifies on failure when the user has no GitHub token', async () => {
    const user = await createUser({ githubAccessToken: null, syncNotifications: true });
    const repo = await createRepository(user.id);

    await expect(processSync({ data: { repositoryId: repo.id } })).rejects.toThrow(
      'No GitHub access token'
    );

    const jobs = await prisma.syncJob.findMany({ where: { repositoryId: repo.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ status: 'failed', error: 'No GitHub access token' });

    const notifs = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('sync_failed');
  });

  it('throws without creating a sync job for an unknown repository', async () => {
    await expect(
      processSync({ data: { repositoryId: '11111111-1111-4111-8111-111111111111' } })
    ).rejects.toThrow('not found');

    expect(await prisma.syncJob.count()).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPrMetrics,
  getCommitMetrics,
  getStalePrs,
  getContributorLeaderboard,
  getPeriodComparison,
} from './analyticsService.js';
import { createUser, createRepository, createPullRequest, createCommit } from '../test/factories.js';

const SINCE = new Date('2026-01-01T00:00:00Z');
const UNTIL = new Date('2026-02-01T00:00:00Z');
const range = { since: SINCE, until: UNTIL };

let repo;
beforeEach(async () => {
  const user = await createUser();
  repo = await createRepository(user.id);
});

describe('getPrMetrics', () => {
  it('returns zeroed metrics for a repo with no PRs in the window', async () => {
    const m = await getPrMetrics(repo.id, range);
    expect(m).toMatchObject({
      total: 0,
      merged: 0,
      open: 0,
      mergeRate: 0,
      avgTimeToMergeHours: null,
      avgReviewTurnaroundHours: null,
    });
  });

  it('counts state, merge rate and average time-to-merge', async () => {
    await createPullRequest(repo.id, {
      state: 'closed',
      createdAt: new Date('2026-01-10T00:00:00Z'),
      mergedAt: new Date('2026-01-11T00:00:00Z'), // +24h
    });
    await createPullRequest(repo.id, { state: 'open', createdAt: new Date('2026-01-12T00:00:00Z') });
    await createPullRequest(repo.id, { state: 'closed', createdAt: new Date('2026-01-13T00:00:00Z') });

    const m = await getPrMetrics(repo.id, range);
    expect(m.total).toBe(3);
    expect(m.merged).toBe(1);
    expect(m.open).toBe(1);
    expect(m.mergeRate).toBe(33);
    expect(m.avgTimeToMergeHours).toBe(24);
  });

  it('excludes PRs created outside the window', async () => {
    await createPullRequest(repo.id, { createdAt: new Date('2025-12-15T00:00:00Z') });
    await createPullRequest(repo.id, { createdAt: new Date('2026-03-01T00:00:00Z') });
    await createPullRequest(repo.id, { createdAt: new Date('2026-01-15T00:00:00Z') });

    expect((await getPrMetrics(repo.id, range)).total).toBe(1);
  });

  it('averages review turnaround from firstReviewAt', async () => {
    await createPullRequest(repo.id, {
      createdAt: new Date('2026-01-05T00:00:00Z'),
      firstReviewAt: new Date('2026-01-05T04:00:00Z'), // +4h
    });
    await createPullRequest(repo.id, {
      createdAt: new Date('2026-01-06T00:00:00Z'),
      firstReviewAt: new Date('2026-01-06T08:00:00Z'), // +8h
    });
    expect((await getPrMetrics(repo.id, range)).avgReviewTurnaroundHours).toBe(6);
  });
});

describe('getCommitMetrics', () => {
  it('counts distinct contributors and conventional-commit compliance', async () => {
    await createCommit(repo.id, { authorLogin: 'alice', message: 'feat: a', committedAt: new Date('2026-01-05T00:00:00Z') });
    await createCommit(repo.id, { authorLogin: 'alice', message: 'fix: b', committedAt: new Date('2026-01-06T00:00:00Z') });
    await createCommit(repo.id, { authorLogin: 'bob', message: 'wip', committedAt: new Date('2026-01-07T00:00:00Z') });
    await createCommit(repo.id, { authorLogin: 'bob', message: 'more stuff', committedAt: new Date('2026-01-08T00:00:00Z') });

    const m = await getCommitMetrics(repo.id, range);
    expect(m.total).toBe(4);
    expect(m.contributorCount).toBe(2);
    expect(m.complianceRate).toBe(50);
  });

  it('ignores commits outside the window', async () => {
    await createCommit(repo.id, { committedAt: new Date('2025-11-01T00:00:00Z') });
    await createCommit(repo.id, { committedAt: new Date('2026-01-20T00:00:00Z') });
    expect((await getCommitMetrics(repo.id, range)).total).toBe(1);
  });
});

describe('getStalePrs', () => {
  it('returns only open PRs older than 7 days, oldest first, with an age in days', async () => {
    const daysAgo = (n) => new Date(Date.now() - n * 86400000);
    await createPullRequest(repo.id, { state: 'open', createdAt: daysAgo(40), title: 'ancient' });
    await createPullRequest(repo.id, { state: 'open', createdAt: daysAgo(10), title: 'stale' });
    await createPullRequest(repo.id, { state: 'open', createdAt: daysAgo(2), title: 'fresh' });
    await createPullRequest(repo.id, { state: 'closed', createdAt: daysAgo(30), title: 'closed-old' });
    await createPullRequest(repo.id, { state: 'closed', createdAt: daysAgo(20), mergedAt: daysAgo(19), title: 'merged-old' });

    const stale = await getStalePrs(repo.id);
    expect(stale.map((p) => p.title)).toEqual(['ancient', 'stale']);
    expect(stale[0].ageDays).toBeGreaterThanOrEqual(39);
  });

  it('caps the list at 8', async () => {
    const old = new Date(Date.now() - 30 * 86400000);
    for (let i = 0; i < 12; i++) await createPullRequest(repo.id, { state: 'open', createdAt: old });
    expect(await getStalePrs(repo.id)).toHaveLength(8);
  });
});

describe('getContributorLeaderboard', () => {
  it('aggregates PRs and commits per author, ranked by combined volume', async () => {
    await createPullRequest(repo.id, { authorLogin: 'alice', createdAt: new Date('2026-01-05T00:00:00Z') });
    await createPullRequest(repo.id, { authorLogin: 'alice', createdAt: new Date('2026-01-06T00:00:00Z') });
    await createCommit(repo.id, { authorLogin: 'alice', committedAt: new Date('2026-01-07T00:00:00Z') });
    await createCommit(repo.id, { authorLogin: 'bob', committedAt: new Date('2026-01-08T00:00:00Z') });

    const board = await getContributorLeaderboard(repo.id, range);
    expect(board.map((c) => c.login)).toEqual(['alice', 'bob']);
    expect(board[0]).toMatchObject({ login: 'alice', prCount: 2, commitCount: 1 });
    expect(board[1]).toMatchObject({ login: 'bob', prCount: 0, commitCount: 1 });
  });
});

describe('getPeriodComparison', () => {
  it('splits activity into the current and preceding window of equal length', async () => {
    // window is January; previous period is December.
    await createPullRequest(repo.id, { createdAt: new Date('2026-01-10T00:00:00Z') });
    await createPullRequest(repo.id, { createdAt: new Date('2026-01-20T00:00:00Z') });
    await createPullRequest(repo.id, { createdAt: new Date('2025-12-15T00:00:00Z') });

    const cmp = await getPeriodComparison(repo.id, range);
    expect(cmp.prCount.current).toBe(2);
    expect(cmp.prCount.previous).toBe(1);
    expect(cmp.prCount.deltaPct).toBe(100);
  });

  it('reports a null delta when the previous window had no activity', async () => {
    await createPullRequest(repo.id, { createdAt: new Date('2026-01-10T00:00:00Z') });
    const cmp = await getPeriodComparison(repo.id, range);
    expect(cmp.prCount).toMatchObject({ current: 1, previous: 0, deltaPct: null });
  });

  it('reports a zero delta when both windows are empty', async () => {
    const cmp = await getPeriodComparison(repo.id, range);
    expect(cmp.commitCount).toMatchObject({ current: 0, previous: 0, deltaPct: 0 });
  });

  it('can scope the comparison to a single author', async () => {
    await createPullRequest(repo.id, { authorLogin: 'alice', createdAt: new Date('2026-01-10T00:00:00Z') });
    await createPullRequest(repo.id, { authorLogin: 'bob', createdAt: new Date('2026-01-11T00:00:00Z') });
    const cmp = await getPeriodComparison(repo.id, range, 'alice');
    expect(cmp.prCount.current).toBe(1);
  });
});

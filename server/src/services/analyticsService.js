import prisma from '../lib/prisma.js';

export const getPrMetrics = async (repositoryId, { since, until }) => {
  const prs = await prisma.pullRequest.findMany({
    where: { repositoryId, createdAt: { gte: since, lte: until } },
    select: {
      state: true,
      createdAt: true,
      mergedAt: true,
      closedAt: true,
      additions: true,
      deletions: true,
      changedFiles: true,
      reviewCount: true,
      commentCount: true,
    },
  });

  const total = prs.length;
  const merged = prs.filter((p) => p.mergedAt);
  const open = prs.filter((p) => p.state === 'open');

  const mergeRate = total > 0 ? Math.round((merged.length / total) * 100) : 0;

  const mergeTimes = merged
    .map((p) => new Date(p.mergedAt) - new Date(p.createdAt))
    .filter((ms) => ms > 0);

  const avgTimeToMergeHours =
    mergeTimes.length > 0
      ? Math.round(mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length / 3600000)
      : null;

  const totalAdditions = prs.reduce((sum, p) => sum + p.additions, 0);
  const totalDeletions = prs.reduce((sum, p) => sum + p.deletions, 0);

  const avgReviewCount =
    total > 0 ? +(prs.reduce((sum, p) => sum + p.reviewCount, 0) / total).toFixed(1) : 0;

  // PR throughput: merged PRs grouped by week
  const weeklyThroughput = buildWeeklyBuckets(
    merged.map((p) => p.mergedAt),
    since,
    until,
  );

  return {
    total,
    merged: merged.length,
    open: open.length,
    mergeRate,
    avgTimeToMergeHours,
    totalAdditions,
    totalDeletions,
    avgReviewCount,
    weeklyThroughput,
  };
};

export const getCommitMetrics = async (repositoryId, { since, until }) => {
  const commits = await prisma.commit.findMany({
    where: { repositoryId, committedAt: { gte: since, lte: until } },
    select: {
      authorLogin: true,
      committedAt: true,
      additions: true,
      deletions: true,
    },
  });

  const total = commits.length;

  // Unique contributors
  const contributors = [...new Set(commits.map((c) => c.authorLogin).filter(Boolean))];

  // Commits per day across the range
  const dailyActivity = buildDailyBuckets(
    commits.map((c) => c.committedAt),
    since,
    until,
  );

  // Top contributors by commit count
  const countByAuthor = {};
  for (const c of commits) {
    if (c.authorLogin) countByAuthor[c.authorLogin] = (countByAuthor[c.authorLogin] || 0) + 1;
  }
  const topContributors = Object.entries(countByAuthor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([login, count]) => ({ login, count }));

  const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);

  return {
    total,
    contributorCount: contributors.length,
    topContributors,
    totalAdditions,
    totalDeletions,
    dailyActivity,
  };
};

export const getContributorSummary = async (repositoryId, login, { since, until }) => {
  const [prs, commits] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId, authorLogin: login, createdAt: { gte: since, lte: until } },
      select: { mergedAt: true, createdAt: true, additions: true, deletions: true },
    }),
    prisma.commit.findMany({
      where: { repositoryId, authorLogin: login, committedAt: { gte: since, lte: until } },
      select: { additions: true, deletions: true },
    }),
  ]);

  const merged = prs.filter((p) => p.mergedAt);
  const mergeTimes = merged
    .map((p) => new Date(p.mergedAt) - new Date(p.createdAt))
    .filter((ms) => ms > 0);

  return {
    prCount: prs.length,
    mergedPrCount: merged.length,
    mergeRate: prs.length > 0 ? Math.round((merged.length / prs.length) * 100) : 0,
    avgTimeToMergeHours:
      mergeTimes.length > 0
        ? Math.round(mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length / 3600000)
        : null,
    commitCount: commits.length,
    totalAdditions:
      prs.reduce((sum, p) => sum + p.additions, 0) + commits.reduce((sum, c) => sum + c.additions, 0),
    totalDeletions:
      prs.reduce((sum, p) => sum + p.deletions, 0) + commits.reduce((sum, c) => sum + c.deletions, 0),
  };
};

export const getPeriodComparison = async (repositoryId, { since, until }, authorLogin = null) => {
  const periodStart = since;
  const previousStart = new Date(since.getTime() - (until.getTime() - since.getTime()));

  const [prs, commits] = await Promise.all([
    prisma.pullRequest.findMany({
      where: {
        repositoryId,
        createdAt: { gte: previousStart, lte: until },
        ...(authorLogin ? { authorLogin } : {}),
      },
      select: { createdAt: true, mergedAt: true },
    }),
    prisma.commit.findMany({
      where: {
        repositoryId,
        committedAt: { gte: previousStart, lte: until },
        ...(authorLogin ? { authorLogin } : {}),
      },
      select: { committedAt: true },
    }),
  ]);

  const currentPrs = prs.filter((p) => p.createdAt >= periodStart);
  const previousPrs = prs.filter((p) => p.createdAt < periodStart);
  const currentCommits = commits.filter((c) => c.committedAt >= periodStart);
  const previousCommits = commits.filter((c) => c.committedAt < periodStart);

  const avgMergeHours = (list) => {
    const times = list
      .filter((p) => p.mergedAt)
      .map((p) => new Date(p.mergedAt) - new Date(p.createdAt))
      .filter((ms) => ms > 0);
    return times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 3600000)
      : null;
  };

  // null deltaPct means "no baseline to compare against" (previous period had zero activity)
  const pctDelta = (current, previous) => {
    if (previous === 0) return current === 0 ? 0 : null;
    return Math.round(((current - previous) / previous) * 100);
  };

  const currentAvgMerge = avgMergeHours(currentPrs);
  const previousAvgMerge = avgMergeHours(previousPrs);
  const currentMergedCount = currentPrs.filter((p) => p.mergedAt).length;
  const previousMergedCount = previousPrs.filter((p) => p.mergedAt).length;

  return {
    prCount: {
      current: currentPrs.length,
      previous: previousPrs.length,
      deltaPct: pctDelta(currentPrs.length, previousPrs.length),
    },
    mergedCount: {
      current: currentMergedCount,
      previous: previousMergedCount,
      deltaPct: pctDelta(currentMergedCount, previousMergedCount),
    },
    avgTimeToMergeHours: {
      current: currentAvgMerge,
      previous: previousAvgMerge,
      deltaPct:
        currentAvgMerge != null && previousAvgMerge != null
          ? pctDelta(currentAvgMerge, previousAvgMerge)
          : null,
    },
    commitCount: {
      current: currentCommits.length,
      previous: previousCommits.length,
      deltaPct: pctDelta(currentCommits.length, previousCommits.length),
    },
  };
};

// Helpers

const buildDailyBuckets = (dates, since, until) => {
  const buckets = {};
  const cursor = new Date(since);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(until);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    buckets[cursor.toISOString().slice(0, 10)] = 0;
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const date of dates) {
    const key = new Date(date).toISOString().slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
};

const buildWeeklyBuckets = (dates, since, until) => {
  const buckets = [];
  const cursor = new Date(since);
  while (cursor < until) {
    buckets.push({ weekStart: cursor.toISOString().slice(0, 10), count: 0 });
    cursor.setDate(cursor.getDate() + 7);
  }
  for (const date of dates) {
    const t = new Date(date).getTime();
    for (const b of buckets) {
      const s = new Date(b.weekStart).getTime();
      if (t >= s && t < s + 7 * 86400000) {
        b.count++;
        break;
      }
    }
  }
  return buckets;
};

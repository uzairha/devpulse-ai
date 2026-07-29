import prisma from '../lib/prisma.js';

const getDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

export const getPrMetrics = async (repositoryId, days = 30) => {
  const since = getDaysAgo(days);

  const prs = await prisma.pullRequest.findMany({
    where: { repositoryId, createdAt: { gte: since } },
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
    days,
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

export const getCommitMetrics = async (repositoryId, days = 30) => {
  const since = getDaysAgo(days);

  const commits = await prisma.commit.findMany({
    where: { repositoryId, committedAt: { gte: since } },
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

  // Commits per day (last `days` days)
  const dailyActivity = buildDailyBuckets(
    commits.map((c) => c.committedAt),
    days,
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

// Helpers

const buildDailyBuckets = (dates, days) => {
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const date of dates) {
    const key = new Date(date).toISOString().slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
};

const buildWeeklyBuckets = (dates, days) => {
  const weeks = Math.ceil(days / 7);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date();
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    buckets.push({ weekStart: start.toISOString().slice(0, 10), count: 0 });
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

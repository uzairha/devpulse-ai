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
      firstReviewAt: true,
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

  const reviewTurnaroundTimes = prs
    .filter((p) => p.firstReviewAt)
    .map((p) => new Date(p.firstReviewAt) - new Date(p.createdAt))
    .filter((ms) => ms > 0);

  const avgReviewTurnaroundHours =
    reviewTurnaroundTimes.length > 0
      ? Math.round(
          reviewTurnaroundTimes.reduce((a, b) => a + b, 0) / reviewTurnaroundTimes.length / 3600000,
        )
      : null;

  // PR throughput: merged PRs grouped by week
  const weeklyThroughput = buildWeeklyBuckets(
    merged.map((p) => p.mergedAt),
    since,
    until,
  );

  const sizeBreakdown = buildPrSizeBreakdown(prs);

  return {
    total,
    merged: merged.length,
    open: open.length,
    mergeRate,
    avgTimeToMergeHours,
    totalAdditions,
    totalDeletions,
    avgReviewCount,
    avgReviewTurnaroundHours,
    weeklyThroughput,
    sizeBreakdown,
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
      message: true,
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

  const commitTypes = commits.map((c) => c.message.match(CONVENTIONAL_COMMIT_RE)?.[1] ?? null);
  const compliantCount = commitTypes.filter(Boolean).length;
  const complianceRate = total > 0 ? Math.round((compliantCount / total) * 100) : 0;
  const typeBreakdown = buildCommitTypeBreakdown(commitTypes);

  return {
    total,
    contributorCount: contributors.length,
    topContributors,
    totalAdditions,
    totalDeletions,
    complianceRate,
    typeBreakdown,
    dailyActivity,
  };
};

export const getContributorSummary = async (repositoryId, login, { since, until }) => {
  const [prs, commits] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId, authorLogin: login, createdAt: { gte: since, lte: until } },
      select: { mergedAt: true, createdAt: true, additions: true, deletions: true, firstReviewAt: true },
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

  const reviewTurnaroundTimes = prs
    .filter((p) => p.firstReviewAt)
    .map((p) => new Date(p.firstReviewAt) - new Date(p.createdAt))
    .filter((ms) => ms > 0);

  return {
    prCount: prs.length,
    mergedPrCount: merged.length,
    mergeRate: prs.length > 0 ? Math.round((merged.length / prs.length) * 100) : 0,
    avgTimeToMergeHours:
      mergeTimes.length > 0
        ? Math.round(mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length / 3600000)
        : null,
    avgReviewTurnaroundHours:
      reviewTurnaroundTimes.length > 0
        ? Math.round(
            reviewTurnaroundTimes.reduce((a, b) => a + b, 0) / reviewTurnaroundTimes.length / 3600000,
          )
        : null,
    commitCount: commits.length,
    totalAdditions:
      prs.reduce((sum, p) => sum + p.additions, 0) + commits.reduce((sum, c) => sum + c.additions, 0),
    totalDeletions:
      prs.reduce((sum, p) => sum + p.deletions, 0) + commits.reduce((sum, c) => sum + c.deletions, 0),
  };
};

export const getContributorLeaderboard = async (repositoryId, { since, until }) => {
  const [prs, commits] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId, createdAt: { gte: since, lte: until } },
      select: { authorLogin: true, mergedAt: true, additions: true, deletions: true },
    }),
    prisma.commit.findMany({
      where: { repositoryId, committedAt: { gte: since, lte: until } },
      select: { authorLogin: true, additions: true, deletions: true },
    }),
  ]);

  const byAuthor = {};
  const entryFor = (login) => {
    if (!byAuthor[login]) {
      byAuthor[login] = {
        login,
        prCount: 0,
        mergedPrCount: 0,
        commitCount: 0,
        additions: 0,
        deletions: 0,
      };
    }
    return byAuthor[login];
  };

  for (const pr of prs) {
    if (!pr.authorLogin) continue;
    const entry = entryFor(pr.authorLogin);
    entry.prCount++;
    if (pr.mergedAt) entry.mergedPrCount++;
    entry.additions += pr.additions;
    entry.deletions += pr.deletions;
  }

  for (const c of commits) {
    if (!c.authorLogin) continue;
    const entry = entryFor(c.authorLogin);
    entry.commitCount++;
    entry.additions += c.additions;
    entry.deletions += c.deletions;
  }

  return Object.values(byAuthor)
    .sort((a, b) => b.prCount + b.commitCount - (a.prCount + a.commitCount))
    .slice(0, 10);
};

const SPARKLINE_DAYS = 14;

// Compact activity summary for repo list cards: a 14-day daily PR+commit count
// series plus the timestamp of the single most recent PR/commit, independent of
// any dashboard date-range selection.
export const getRepoActivitySparkline = async (repositoryId) => {
  const until = new Date();
  const since = new Date(until);
  since.setDate(since.getDate() - SPARKLINE_DAYS);

  const [prs, commits] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId, createdAt: { gte: since, lte: until } },
      select: { createdAt: true },
    }),
    prisma.commit.findMany({
      where: { repositoryId, committedAt: { gte: since, lte: until } },
      select: { committedAt: true },
    }),
  ]);

  const dates = [...prs.map((p) => p.createdAt), ...commits.map((c) => c.committedAt)];
  const daily = buildDailyBuckets(dates, since, until);
  const lastActivityAt =
    dates.length > 0 ? new Date(Math.max(...dates.map((d) => new Date(d).getTime()))) : null;

  return { daily, lastActivityAt };
};

const STALE_PR_THRESHOLD_DAYS = 7;

export const getStalePrs = async (repositoryId) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_PR_THRESHOLD_DAYS);

  const prs = await prisma.pullRequest.findMany({
    where: { repositoryId, state: 'open', createdAt: { lte: cutoff } },
    select: { number: true, title: true, authorLogin: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 8,
  });

  const now = Date.now();
  return prs.map((p) => ({
    ...p,
    ageDays: Math.floor((now - new Date(p.createdAt).getTime()) / 86400000),
  }));
};

export const getActivityHeatmap = async (repositoryId, { since, until }) => {
  const [prs, commits] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId, createdAt: { gte: since, lte: until } },
      select: { createdAt: true },
    }),
    prisma.commit.findMany({
      where: { repositoryId, committedAt: { gte: since, lte: until } },
      select: { committedAt: true },
    }),
  ]);

  return buildHeatmapCells([...prs.map((p) => p.createdAt), ...commits.map((c) => c.committedAt)]);
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
      select: { createdAt: true, mergedAt: true, firstReviewAt: true },
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

  const avgReviewTurnaroundHours = (list) => {
    const times = list
      .filter((p) => p.firstReviewAt)
      .map((p) => new Date(p.firstReviewAt) - new Date(p.createdAt))
      .filter((ms) => ms > 0);
    return times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 3600000)
      : null;
  };

  const currentAvgReviewTurnaround = avgReviewTurnaroundHours(currentPrs);
  const previousAvgReviewTurnaround = avgReviewTurnaroundHours(previousPrs);

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
    avgReviewTurnaroundHours: {
      current: currentAvgReviewTurnaround,
      previous: previousAvgReviewTurnaround,
      deltaPct:
        currentAvgReviewTurnaround != null && previousAvgReviewTurnaround != null
          ? pctDelta(currentAvgReviewTurnaround, previousAvgReviewTurnaround)
          : null,
    },
  };
};

// Helpers

// Matches a leading Conventional Commits type, e.g. "feat(api): add X" or "fix!: Y"
const CONVENTIONAL_COMMIT_RE =
  /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]+\))?!?:\s/;

const buildCommitTypeBreakdown = (types) => {
  const counts = {};
  for (const type of types) {
    const key = type ?? 'other';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
};

const PR_SIZE_BUCKETS = [
  { label: 'XS', max: 10 },
  { label: 'S', max: 50 },
  { label: 'M', max: 200 },
  { label: 'L', max: 500 },
  { label: 'XL', max: Infinity },
];

const buildPrSizeBreakdown = (prs) => {
  const counts = Object.fromEntries(PR_SIZE_BUCKETS.map((b) => [b.label, 0]));
  for (const pr of prs) {
    const changed = pr.additions + pr.deletions;
    const bucket = PR_SIZE_BUCKETS.find((b) => changed <= b.max);
    counts[bucket.label]++;
  }
  return PR_SIZE_BUCKETS.map((b) => ({ label: b.label, count: counts[b.label] }));
};

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

// day: 0 (Sun) - 6 (Sat), hour: 0-23, both UTC to match the ISO-date bucketing used elsewhere
const buildHeatmapCells = (dates) => {
  const counts = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const date of dates) {
    const d = new Date(date);
    counts[d.getUTCDay()][d.getUTCHours()]++;
  }
  const cells = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, count: counts[day][hour] });
    }
  }
  return cells;
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

import prisma from '../lib/prisma.js';
import {
  getPrMetrics,
  getCommitMetrics,
  getContributorSummary,
  getContributorLeaderboard,
  getPeriodComparison,
  getActivityHeatmap,
  getStalePrs,
} from '../services/analyticsService.js';
import { calculateHealthScore } from '../services/aiService.js';
import { getCached, setCached } from '../lib/cache.js';

const MAX_RANGE_DAYS = 365;

// Resolves either ?days=N (preset, relative to now) or ?startDate=&endDate= (custom range)
// into a concrete { since, until } window, clamped to now and to MAX_RANGE_DAYS.
const resolveRange = (query) => {
  const now = new Date();

  if (query.startDate && query.endDate) {
    const since = new Date(`${query.startDate}T00:00:00.000Z`);
    const until = new Date(`${query.endDate}T23:59:59.999Z`);
    if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || since > until) {
      return null;
    }
    if (until > now) until.setTime(now.getTime());

    const minSince = new Date(until);
    minSince.setDate(minSince.getDate() - MAX_RANGE_DAYS);
    if (since < minSince) since.setTime(minSince.getTime());

    return { since, until };
  }

  const days = Math.min(parseInt(query.days) || 30, MAX_RANGE_DAYS);
  const until = now;
  const since = new Date(until);
  since.setDate(since.getDate() - days);
  return { since, until };
};

const rangeCacheKey = ({ since, until }) =>
  `${since.toISOString().slice(0, 10)}:${until.toISOString().slice(0, 10)}`;

export const getRepoAnalytics = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const range = resolveRange(req.query);
    if (!range) return res.status(400).json({ error: 'Invalid date range' });

    const cacheKey = `analytics:${repo.id}:overview:${rangeCacheKey(range)}`;

    const cached = await getCached(cacheKey);
    if (cached) return res.json(cached);

    const [prMetrics, commitMetrics, trends, leaderboard, activityHeatmap, stalePrs] = await Promise.all([
      getPrMetrics(repo.id, range),
      getCommitMetrics(repo.id, range),
      getPeriodComparison(repo.id, range),
      getContributorLeaderboard(repo.id, range),
      getActivityHeatmap(repo.id, range),
      getStalePrs(repo.id),
    ]);

    const payload = {
      repo: { id: repo.id, fullName: repo.fullName, lastSyncAt: repo.lastSyncAt },
      startDate: range.since.toISOString().slice(0, 10),
      endDate: range.until.toISOString().slice(0, 10),
      prMetrics,
      commitMetrics,
      trends,
      leaderboard,
      activityHeatmap,
      stalePrs,
    };
    await setCached(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

export const compareRepos = async (req, res, next) => {
  try {
    const range = resolveRange(req.query);
    if (!range) return res.status(400).json({ error: 'Invalid date range' });

    const cacheKey = `analytics:compare:${req.user.id}:${rangeCacheKey(range)}`;
    const cached = await getCached(cacheKey);
    if (cached) return res.json(cached);

    const repos = await prisma.repository.findMany({
      where: { userId: req.user.id },
      select: { id: true, fullName: true, language: true, lastSyncAt: true },
      orderBy: { fullName: 'asc' },
    });

    const repoSummaries = await Promise.all(
      repos.map(async (repo) => {
        const [pr, cm, health] = await Promise.all([
          getPrMetrics(repo.id, range),
          getCommitMetrics(repo.id, range),
          calculateHealthScore(repo.id),
        ]);

        return {
          repo: { id: repo.id, fullName: repo.fullName, language: repo.language, lastSyncAt: repo.lastSyncAt },
          prCount: pr.total,
          mergedCount: pr.merged,
          mergeRate: pr.mergeRate,
          openCount: pr.open,
          avgTimeToMergeHours: pr.avgTimeToMergeHours,
          avgReviewTurnaroundHours: pr.avgReviewTurnaroundHours,
          commitCount: cm.total,
          contributorCount: cm.contributorCount,
          commitComplianceRate: cm.complianceRate,
          additions: pr.totalAdditions + cm.totalAdditions,
          deletions: pr.totalDeletions + cm.totalDeletions,
          healthScore: health.score,
        };
      }),
    );

    repoSummaries.sort((a, b) => b.prCount + b.commitCount - (a.prCount + a.commitCount));

    const payload = {
      startDate: range.since.toISOString().slice(0, 10),
      endDate: range.until.toISOString().slice(0, 10),
      repos: repoSummaries,
    };
    await setCached(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

export const listPullRequests = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;
    const stateFilter = req.query.state;

    const where = { repositoryId: repo.id };
    if (stateFilter === 'open') where.state = 'open';
    else if (stateFilter === 'closed') where.state = 'closed';
    else if (stateFilter === 'merged') where.mergedAt = { not: null };
    if (req.query.author) where.authorLogin = req.query.author;
    if (req.query.q) where.title = { contains: req.query.q, mode: 'insensitive' };

    const [prs, total] = await Promise.all([
      prisma.pullRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, number: true, title: true, state: true,
          authorLogin: true, authorAvatarUrl: true,
          createdAt: true, mergedAt: true, closedAt: true,
          additions: true, deletions: true, changedFiles: true,
          reviewCount: true, commentCount: true,
        },
      }),
      prisma.pullRequest.count({ where }),
    ]);

    res.json({ data: prs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

export const listCommits = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const where = { repositoryId: repo.id };
    if (req.query.author) where.authorLogin = req.query.author;
    if (req.query.q) where.message = { contains: req.query.q, mode: 'insensitive' };

    const [commits, total] = await Promise.all([
      prisma.commit.findMany({
        where,
        orderBy: { committedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, sha: true, message: true,
          authorLogin: true, committedAt: true,
          additions: true, deletions: true,
        },
      }),
      prisma.commit.count({ where }),
    ]);

    res.json({ data: commits, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

export const getContributor = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const range = resolveRange(req.query);
    if (!range) return res.status(400).json({ error: 'Invalid date range' });

    const cacheKey = `analytics:${repo.id}:contributor:${req.params.login}:${rangeCacheKey(range)}`;

    const cached = await getCached(cacheKey);
    if (cached) return res.json(cached);

    const summary = await getContributorSummary(repo.id, req.params.login, range);

    if (summary.prCount === 0 && summary.commitCount === 0) {
      return res.status(404).json({ error: 'No activity found for this contributor' });
    }

    const trends = await getPeriodComparison(repo.id, range, req.params.login);

    const payload = {
      login: req.params.login,
      startDate: range.since.toISOString().slice(0, 10),
      endDate: range.until.toISOString().slice(0, 10),
      repo: { id: repo.id, fullName: repo.fullName },
      ...summary,
      trends,
    };
    await setCached(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

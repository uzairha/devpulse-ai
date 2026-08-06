import prisma from '../lib/prisma.js';
import { getPrMetrics, getCommitMetrics, getContributorSummary } from '../services/analyticsService.js';
import { getCached, setCached } from '../lib/cache.js';

export const getRepoAnalytics = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const cacheKey = `analytics:${repo.id}:overview:${days}`;

    const cached = await getCached(cacheKey);
    if (cached) return res.json(cached);

    const [prMetrics, commitMetrics] = await Promise.all([
      getPrMetrics(repo.id, days),
      getCommitMetrics(repo.id, days),
    ]);

    const payload = { repo: { id: repo.id, fullName: repo.fullName, lastSyncAt: repo.lastSyncAt }, days, prMetrics, commitMetrics };
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

    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const cacheKey = `analytics:${repo.id}:contributor:${req.params.login}:${days}`;

    const cached = await getCached(cacheKey);
    if (cached) return res.json(cached);

    const summary = await getContributorSummary(repo.id, req.params.login, days);

    if (summary.prCount === 0 && summary.commitCount === 0) {
      return res.status(404).json({ error: 'No activity found for this contributor' });
    }

    const payload = {
      login: req.params.login,
      days,
      repo: { id: repo.id, fullName: repo.fullName },
      ...summary,
    };
    await setCached(cacheKey, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
};

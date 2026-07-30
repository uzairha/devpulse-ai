import prisma from '../lib/prisma.js';
import { getPrMetrics, getCommitMetrics } from '../services/analyticsService.js';

export const getRepoAnalytics = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const days = Math.min(parseInt(req.query.days) || 30, 365);

    const [prMetrics, commitMetrics] = await Promise.all([
      getPrMetrics(repo.id, days),
      getCommitMetrics(repo.id, days),
    ]);

    res.json({ repo: { id: repo.id, fullName: repo.fullName, lastSyncAt: repo.lastSyncAt }, days, prMetrics, commitMetrics });
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

    const [prs, total] = await Promise.all([
      prisma.pullRequest.findMany({
        where: { repositoryId: repo.id },
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
      prisma.pullRequest.count({ where: { repositoryId: repo.id } }),
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

    const [commits, total] = await Promise.all([
      prisma.commit.findMany({
        where: { repositoryId: repo.id },
        orderBy: { committedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, sha: true, message: true,
          authorLogin: true, committedAt: true,
          additions: true, deletions: true,
        },
      }),
      prisma.commit.count({ where: { repositoryId: repo.id } }),
    ]);

    res.json({ data: commits, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

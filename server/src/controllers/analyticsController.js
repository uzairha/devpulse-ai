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

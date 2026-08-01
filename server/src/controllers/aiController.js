import prisma from '../lib/prisma.js';
import { generatePrSummary, calculateHealthScore } from '../services/aiService.js';

export const summarizePr = async (req, res, next) => {
  try {
    const { prId } = req.body;

    const pr = await prisma.pullRequest.findUnique({
      where: { id: prId },
      include: { repository: { select: { userId: true } } },
    });

    if (!pr) return res.status(404).json({ error: 'Pull request not found' });
    if (pr.repository.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const summary = await generatePrSummary(pr);
    res.json({ summary });
  } catch (err) {
    next(err);
  }
};

export const getHealthScore = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const result = await calculateHealthScore(repo.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

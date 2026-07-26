import prisma from '../lib/prisma.js';
import { getUserRepos } from '../services/githubApiService.js';

export const listAvailableRepos = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.githubAccessToken) {
      return res.json([]);
    }

    const [ghRepos, connectedRepos] = await Promise.all([
      getUserRepos(user.githubAccessToken),
      prisma.repository.findMany({ where: { userId: req.user.id }, select: { githubId: true } }),
    ]);

    const connectedIds = new Set(connectedRepos.map((r) => r.githubId));
    const available = ghRepos
      .filter((r) => !connectedIds.has(r.id))
      .map((r) => ({
        githubId: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        language: r.language,
        private: r.private,
        stargazersCount: r.stargazers_count,
        updatedAt: r.updated_at,
      }));

    res.json(available);
  } catch (err) {
    next(err);
  }
};

export const connectRepo = async (req, res, next) => {
  try {
    const { githubRepoId } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.githubAccessToken) {
      return res.status(400).json({ error: 'GitHub account not connected' });
    }

    const allRepos = await getUserRepos(user.githubAccessToken);
    const ghRepo = allRepos.find((r) => r.id === githubRepoId);
    if (!ghRepo) {
      return res.status(404).json({ error: 'Repository not found in your GitHub account' });
    }

    const existing = await prisma.repository.findUnique({ where: { githubId: ghRepo.id } });
    if (existing && existing.userId === req.user.id) {
      return res.status(409).json({ error: 'Repository already connected' });
    }

    const repo = await prisma.repository.create({
      data: {
        userId: req.user.id,
        githubId: ghRepo.id,
        name: ghRepo.name,
        fullName: ghRepo.full_name,
        description: ghRepo.description ?? null,
        language: ghRepo.language ?? null,
        private: ghRepo.private,
      },
    });

    res.status(201).json(repo);
  } catch (err) {
    next(err);
  }
};

export const listRepos = async (req, res, next) => {
  try {
    const repos = await prisma.repository.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(repos);
  } catch (err) {
    next(err);
  }
};

export const disconnectRepo = async (req, res, next) => {
  try {
    const repo = await prisma.repository.findUnique({ where: { id: req.params.id } });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (repo.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.repository.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

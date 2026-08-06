import { Worker } from 'bullmq';
import prisma from '../lib/prisma.js';
import { getRepoPullRequests, getRepoCommits } from '../services/githubApiService.js';
import { createNotification } from '../services/notificationService.js';
import { invalidateRepoCache } from '../lib/cache.js';
import config from '../config/index.js';
import logger from '../lib/logger.js';

const connection = { url: config.redisUrl };

const processSync = async (job) => {
  const { repositoryId } = job.data;

  const repo = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: { user: { select: { id: true, githubAccessToken: true, syncNotifications: true } } },
  });

  if (!repo) throw new Error(`Repository ${repositoryId} not found`);
  if (!repo.user.githubAccessToken) throw new Error('No GitHub access token');

  const syncJob = await prisma.syncJob.create({
    data: { repositoryId, status: 'running', startedAt: new Date() },
  });

  const [owner, repoName] = repo.fullName.split('/');
  const token = repo.user.githubAccessToken;

  try {
    const [prs, commits] = await Promise.all([
      getRepoPullRequests(token, owner, repoName),
      getRepoCommits(token, owner, repoName),
    ]);

    await prisma.$transaction([
      ...prs.map((pr) =>
        prisma.pullRequest.upsert({
          where: { repositoryId_githubPrId: { repositoryId, githubPrId: pr.id } },
          create: {
            repositoryId,
            githubPrId: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            authorLogin: pr.user?.login ?? 'unknown',
            authorAvatarUrl: pr.user?.avatar_url ?? null,
            createdAt: new Date(pr.created_at),
            closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            additions: pr.additions ?? 0,
            deletions: pr.deletions ?? 0,
            changedFiles: pr.changed_files ?? 0,
            reviewCount: pr.review_comments ?? 0,
            commentCount: pr.comments ?? 0,
          },
          update: {
            title: pr.title,
            state: pr.state,
            closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
            mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
            additions: pr.additions ?? 0,
            deletions: pr.deletions ?? 0,
            changedFiles: pr.changed_files ?? 0,
            reviewCount: pr.review_comments ?? 0,
            commentCount: pr.comments ?? 0,
            syncedAt: new Date(),
          },
        }),
      ),
      ...commits.map((c) =>
        prisma.commit.upsert({
          where: { sha: c.sha },
          create: {
            repositoryId,
            sha: c.sha,
            message: c.commit.message.slice(0, 1000),
            authorLogin: c.author?.login ?? null,
            authorEmail: c.commit.author?.email ?? null,
            committedAt: new Date(c.commit.author?.date ?? c.commit.committer?.date),
            additions: c.stats?.additions ?? 0,
            deletions: c.stats?.deletions ?? 0,
          },
          update: {
            syncedAt: new Date(),
          },
        }),
      ),
    ]);

    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    await prisma.repository.update({
      where: { id: repositoryId },
      data: { lastSyncAt: new Date() },
    });

    await invalidateRepoCache(repositoryId);

    logger.info(`Sync completed for ${repo.fullName}: ${prs.length} PRs, ${commits.length} commits`);

    if (repo.user.syncNotifications) {
      await createNotification(repo.user.id, {
        type: 'sync_complete',
        title: 'Sync complete',
        body: `${repo.fullName} synced — ${prs.length} PRs and ${commits.length} commits imported.`,
      });
    }
  } catch (err) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: 'failed', completedAt: new Date(), error: err.message },
    });

    if (repo.user.syncNotifications) {
      await createNotification(repo.user.id, {
        type: 'sync_failed',
        title: 'Sync failed',
        body: `${repo.fullName} sync failed: ${err.message}`,
      }).catch(() => {});
    }

    throw err;
  }
};

export const startSyncWorker = () => {
  const worker = new Worker('repo-sync', processSync, { connection });

  worker.on('failed', (job, err) => {
    logger.error(`Sync job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Sync worker started');
  return worker;
};

import { Worker } from 'bullmq';
import prisma from '../lib/prisma.js';
import { reportQueue } from '../lib/queue.js';
import { generateAndSaveWeeklyReport } from '../services/aiService.js';
import { createNotification } from '../services/notificationService.js';
import config from '../config/index.js';
import logger from '../lib/logger.js';

const connection = { url: config.redisUrl };

// Runs every Monday at 09:00 UTC. jobId keeps re-registration on server
// restart idempotent — BullMQ upserts the repeatable job instead of duplicating it.
const CRON_PATTERN = '0 9 * * 1';

const processWeeklyReports = async () => {
  const repos = await prisma.repository.findMany({
    where: { user: { weeklyReportEmail: true } },
    include: { user: { select: { id: true } } },
  });

  for (const repo of repos) {
    try {
      await generateAndSaveWeeklyReport(repo.id);
      await createNotification(repo.user.id, {
        type: 'weekly_report',
        title: 'Weekly report ready',
        body: `Your weekly digest for ${repo.fullName} is ready to view.`,
      });
    } catch (err) {
      logger.error(`Weekly report generation failed for ${repo.fullName}: ${err.message}`);
    }
  }

  logger.info(`Weekly report run complete: ${repos.length} repositories processed`);
};

export const scheduleWeeklyReports = async () => {
  await reportQueue.add(
    'generate-all',
    {},
    { repeat: { pattern: CRON_PATTERN }, jobId: 'weekly-report-cron' },
  );
};

export const startReportWorker = () => {
  const worker = new Worker('weekly-report', processWeeklyReports, { connection });

  worker.on('failed', (job, err) => {
    logger.error(`Weekly report job ${job?.id} failed: ${err.message}`);
  });

  logger.info('Weekly report worker started');
  return worker;
};

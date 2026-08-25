import { pathToFileURL } from 'node:url';
import config from './config/index.js';
import { startSyncWorker } from './workers/syncWorker.js';
import { startReportWorker, scheduleWeeklyReports } from './workers/reportWorker.js';
import logger from './lib/logger.js';

// Starts every background consumer. Imported by index.js for the single-process
// development path, and run directly as the entrypoint of the dedicated worker
// container in production.
export const startWorkers = () => {
  startSyncWorker();
  startReportWorker();
  scheduleWeeklyReports().catch((err) =>
    logger.error(`Failed to schedule weekly reports: ${err.message}`)
  );
};

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  startWorkers();
  logger.info(`Worker started [${config.nodeEnv}]`);
}

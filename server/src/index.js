import app from './app.js';
import config from './config/index.js';
import { startSyncWorker } from './workers/syncWorker.js';
import { startReportWorker, scheduleWeeklyReports } from './workers/reportWorker.js';
import logger from './lib/logger.js';

startSyncWorker();
startReportWorker();
scheduleWeeklyReports().catch((err) => logger.error(`Failed to schedule weekly reports: ${err.message}`));

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

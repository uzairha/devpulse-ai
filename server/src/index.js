import app from './app.js';
import config from './config/index.js';
import { startWorkers } from './worker.js';
import logger from './lib/logger.js';

// Outside production the API process also runs the workers, so `npm run dev`
// stays a single command. In production the worker is a separate ECS service.
if (config.runWorkersInApi) startWorkers();

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

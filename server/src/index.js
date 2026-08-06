import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import config from './config/index.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import reposRouter from './routes/repos.js';
import analyticsRouter from './routes/analytics.js';
import aiRouter from './routes/ai.js';
import notificationsRouter from './routes/notifications.js';
import errorHandler from './middleware/errorHandler.js';
import { startSyncWorker } from './workers/syncWorker.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json());
app.use(morgan('dev'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers.authorization || req.ip,
  message: { error: 'AI rate limit reached. Please wait a moment before trying again.' },
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/repos', reposRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/notifications', notificationsRouter);

app.use(errorHandler);

startSyncWorker();

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
});

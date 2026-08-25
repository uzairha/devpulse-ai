import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import config from './config/index.js';
import logger from './lib/logger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import reposRouter from './routes/repos.js';
import analyticsRouter from './routes/analytics.js';
import aiRouter from './routes/ai.js';
import notificationsRouter from './routes/notifications.js';
import webhooksRouter from './routes/webhooks.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Behind the ALB the real client IP only exists in X-Forwarded-For. Without
// this, express-rate-limit keys every request on the load balancer's address
// and throttles all users as if they were one.
if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops);

// Integration tests drive many requests through the same routes in one run, which
// would otherwise trip the auth/AI limiters and produce spurious 429s.
const skipRateLimits = config.nodeEnv === 'test';

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
// Webhook signature verification needs the raw request body, so this must be
// parsed before the global JSON parser consumes the stream.
app.use('/api/webhooks/github', express.raw({ type: 'application/json' }));
app.use(express.json());
if (config.nodeEnv !== 'test') {
  // Access logs go through winston so production emits one parseable JSON
  // stream to CloudWatch rather than ANSI-coloured text.
  app.use(
    morgan(config.isProduction ? 'combined' : 'dev', {
      stream: { write: (message) => logger.info(message.trim()) },
    })
  );
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimits,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers.authorization || ipKeyGenerator(req.ip),
  skip: () => skipRateLimits,
  message: { error: 'AI rate limit reached. Please wait a moment before trying again.' },
});

app.use('/api/health', healthRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/repos', reposRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/webhooks', webhooksRouter);

app.use(errorHandler);

export default app;

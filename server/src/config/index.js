import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const DEV_JWT_SECRET = 'dev-secret-change-in-production';

// Fail fast rather than boot a production container with a publicly known
// signing key or no database. Both are deploy-time configuration mistakes, and
// crashing the task is far cheaper than serving forgeable tokens.
const requiredInProduction = (name, value, rejected) => {
  if (!isProduction) return value;
  if (!value || value === rejected) {
    throw new Error(`${name} must be set to a unique value when NODE_ENV=production`);
  }
  return value;
};

const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv,
  isProduction,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: requiredInProduction(
    'JWT_SECRET',
    process.env.JWT_SECRET || (isProduction ? '' : DEV_JWT_SECRET),
    DEV_JWT_SECRET
  ),
  databaseUrl: requiredInProduction('DATABASE_URL', process.env.DATABASE_URL),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  // Number of reverse proxies in front of the app. Behind an ALB this must be 1
  // so express-rate-limit keys on the real client IP from X-Forwarded-For rather
  // than on the load balancer's own address. 0 disables proxy trust entirely.
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS) || 0,
  // In development one process runs the API and both BullMQ workers. In
  // production the worker is its own ECS service, so the API must not also
  // consume jobs - two consumers would double-process every sync.
  runWorkersInApi: process.env.RUN_WORKERS_IN_API
    ? process.env.RUN_WORKERS_IN_API === 'true'
    : !isProduction,
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3001',
  openaiApiKey: process.env.OPENAI_API_KEY,
};

export default config;

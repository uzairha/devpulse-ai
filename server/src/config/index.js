import 'dotenv/config';

const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
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

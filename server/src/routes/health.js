import { Router } from 'express';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import logger from '../lib/logger.js';

const router = Router();

// Liveness. Deliberately touches nothing external: a transient database blip
// should not make ECS kill an otherwise healthy container. This is the endpoint
// the ALB target group and the container HEALTHCHECK use.
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness. Confirms this instance can actually serve traffic. Reports only
// whether each dependency answered - never the driver error, host or version,
// since this endpoint is reachable through the load balancer.
router.get('/ready', async (req, res) => {
  const checks = { database: false, redis: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err) {
    logger.error(`Readiness check failed for database: ${err.message}`);
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch (err) {
    logger.error(`Readiness check failed for redis: ${err.message}`);
  }

  const ready = checks.database && checks.redis;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
});

export default router;

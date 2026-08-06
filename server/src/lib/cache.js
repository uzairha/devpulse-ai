import redis from './redis.js';
import logger from './logger.js';

const DEFAULT_TTL_SECONDS = 120;

export const getCached = async (key) => {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn(`Cache read failed for ${key}: ${err.message}`);
    return null;
  }
};

export const setCached = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn(`Cache write failed for ${key}: ${err.message}`);
  }
};

export const invalidateRepoCache = async (repositoryId) => {
  try {
    const keys = await redis.keys(`analytics:${repositoryId}:*`);
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    logger.warn(`Cache invalidation failed for repo ${repositoryId}: ${err.message}`);
  }
};

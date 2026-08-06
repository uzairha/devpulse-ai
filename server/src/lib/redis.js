import Redis from 'ioredis';
import config from '../config/index.js';

const redis = new Redis(config.redisUrl);

export default redis;

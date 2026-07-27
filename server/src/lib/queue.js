import { Queue } from 'bullmq';
import config from '../config/index.js';

const connection = { url: config.redisUrl };

export const syncQueue = new Queue('repo-sync', { connection });

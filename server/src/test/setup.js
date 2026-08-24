import { beforeAll, beforeEach, afterAll } from 'vitest';
import prisma from '../lib/prisma.js';
import redis from '../lib/redis.js';
import { syncQueue, reportQueue } from '../lib/queue.js';

// This file TRUNCATES every table between tests. The two guards below are the
// only thing standing between a stray `npm test` and the development database,
// so they run before anything else touches Postgres or Redis.
const assertSafeTargets = () => {
  const dbUrl = process.env.DATABASE_URL || '';
  const dbName = dbUrl.split('/').pop().split('?')[0];
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${dbName}" — the test database name must end in "_test". Check server/.env.test.`
    );
  }

  const redisUrl = process.env.REDIS_URL || '';
  const redisDb = redisUrl.split('/')[3];
  if (!redisDb || redisDb === '0') {
    throw new Error(
      `Refusing to flush Redis database "${redisDb || '0'}" — tests must use a non-zero logical database (e.g. redis://localhost:6379/1). Check server/.env.test.`
    );
  }
};

assertSafeTargets();

// Resolved once from the live schema so new Prisma models are picked up without
// having to maintain a hand-written table list here.
let tableNames = null;

const getTableNames = async () => {
  if (tableNames) return tableNames;
  const rows = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
  `;
  tableNames = rows.map((row) => `"public"."${row.tablename}"`);
  return tableNames;
};

export const resetDatabase = async () => {
  const tables = await getTableNames();
  if (!tables.length) {
    throw new Error(
      'Test database has no tables — run `npm run test:db:migrate` to apply migrations to devpulse_test.'
    );
  }
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
};

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await resetDatabase();
  await redis.flushdb();
});

afterAll(async () => {
  // Importing src/app.js pulls in the analytics cache (Redis) and the repo
  // controller (BullMQ queues); all of them hold open connections that would
  // otherwise keep the Vitest process alive after the suite finishes.
  await Promise.allSettled([
    prisma.$disconnect(),
    syncQueue.close(),
    reportQueue.close(),
    redis.quit(),
  ]);
});

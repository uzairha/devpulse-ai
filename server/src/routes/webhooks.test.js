import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { default as app } from '../app.js';
import { syncQueue } from '../lib/queue.js';
import prisma from '../lib/prisma.js';
import { createAuthedUser, createRepository } from '../test/factories.js';

// GITHUB_WEBHOOK_SECRET is pinned in .env.test (see server/.env.test.example)
// so this signature is stable regardless of the developer's own dev .env.
const WEBHOOK_SECRET = 'test-webhook-secret';

const sign = (payload) => {
  const body = JSON.stringify(payload);
  const signature =
    'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  return { body, signature };
};

// `signature` distinguishes three cases: omit it entirely to use the correct
// computed signature, pass a string to send that exact (e.g. invalid) value,
// or pass `omitSignature: true` to send no signature header at all — a plain
// `undefined` here would silently fall through to the default parameter value
// via destructuring and always end up sending *some* header, which is exactly
// the bug this comment is warning off.
const post = (payload, { signature, omitSignature = false, event = 'push' } = {}) => {
  const { body, signature: computed } = sign(payload);
  const req = request(app)
    .post('/api/webhooks/github')
    .set('Content-Type', 'application/json')
    .set('X-GitHub-Event', event);
  if (!omitSignature) req.set('X-Hub-Signature-256', signature ?? computed);
  return req.send(body);
};

describe('POST /api/webhooks/github', () => {
  it('rejects a request with no signature header with 401', async () => {
    const res = await post({ repository: { id: 1 } }, { omitSignature: true });
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid signature with 401', async () => {
    const res = await post({ repository: { id: 1 } }, { signature: 'sha256=' + '0'.repeat(64) });
    expect(res.status).toBe(401);
  });

  it('answers a ping event with 200 without checking the payload for a repository', async () => {
    const res = await post({ zen: 'anything' }, { event: 'ping' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('pong');
  });

  it('ignores a non-push event with 200', async () => {
    const res = await post({ repository: { id: 1 } }, { event: 'pull_request' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Event ignored');
  });

  it('queues a sync for a push to a known, sync-enabled repository', async () => {
    const { user } = await createAuthedUser();
    const repo = await createRepository(user.id, { githubId: 999001, syncEnabled: true });

    const res = await post({ repository: { id: 999001 } });

    expect(res.status).toBe(202);
    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(1);

    const jobs = await syncQueue.getJobs(['waiting', 'delayed']);
    expect(jobs[0].data.repositoryId).toBe(repo.id);
  });

  it('answers 200 with no repository match for an unknown githubId, and queues nothing', async () => {
    const res = await post({ repository: { id: 424242 } });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('No matching repository');
    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(0);
  });

  it('does not queue a sync for a repository with syncEnabled=false', async () => {
    const { user } = await createAuthedUser();
    await createRepository(user.id, { githubId: 999002, syncEnabled: false });

    const res = await post({ repository: { id: 999002 } });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('No matching repository');
    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(0);
  });

  it('does not queue a second sync while one is already running for the repo', async () => {
    const { user } = await createAuthedUser();
    const repo = await createRepository(user.id, { githubId: 999003, syncEnabled: true });
    await prisma.syncJob.create({ data: { repositoryId: repo.id, status: 'running' } });

    const res = await post({ repository: { id: 999003 } });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Sync already in progress');
    const counts = await syncQueue.getJobCounts('waiting', 'delayed');
    expect(counts.waiting + counts.delayed).toBe(0);
  });

  // requireAuth is deliberately not applied to this route: GitHub sends no
  // Authorization header, so the HMAC signature above is the only credential.
  it('accepts a correctly-signed request with no Authorization header at all', async () => {
    const res = await post({ zen: 'no auth needed' }, { event: 'ping' });
    expect(res.status).toBe(200);
  });
});

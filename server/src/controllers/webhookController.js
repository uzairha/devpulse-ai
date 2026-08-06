import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { syncQueue } from '../lib/queue.js';
import config from '../config/index.js';
import logger from '../lib/logger.js';

const verifySignature = (rawBody, signatureHeader) => {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const expected = crypto
    .createHmac('sha256', config.github.webhookSecret)
    .update(rawBody)
    .digest('hex');

  const received = signatureHeader.slice('sha256='.length);
  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(received, 'hex');

  return (
    expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf)
  );
};

export const handleGithubWebhook = async (req, res, next) => {
  try {
    if (!config.github.webhookSecret) {
      return res.status(503).json({ error: 'Webhooks not configured' });
    }

    const rawBody = req.body;
    if (!verifySignature(rawBody, req.headers['x-hub-signature-256'])) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    const payload = JSON.parse(rawBody.toString('utf8'));

    if (event === 'ping') {
      return res.status(200).json({ message: 'pong' });
    }

    if (event !== 'push') {
      return res.status(200).json({ message: 'Event ignored' });
    }

    const githubId = payload.repository?.id;
    const repo = githubId
      ? await prisma.repository.findUnique({ where: { githubId } })
      : null;

    if (!repo || !repo.syncEnabled) {
      return res.status(200).json({ message: 'No matching repository' });
    }

    const running = await prisma.syncJob.findFirst({
      where: { repositoryId: repo.id, status: 'running' },
    });
    if (running) {
      return res.status(200).json({ message: 'Sync already in progress' });
    }

    await syncQueue.add('sync', { repositoryId: repo.id });
    logger.info(`Webhook push event queued sync for ${repo.fullName}`);

    res.status(202).json({ message: 'Sync queued' });
  } catch (err) {
    next(err);
  }
};

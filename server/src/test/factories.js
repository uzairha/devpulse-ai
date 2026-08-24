import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateToken } from '../services/authService.js';

// Deliberately not built on prisma/seed.js: that script randomizes review times
// and cycles commit messages to make the demo look realistic, which is the
// opposite of what assertions need. Everything here is explicit and repeatable —
// a test that cares about a value passes it in, and anything it does not name
// gets a fixed default rather than a random one.

// Unique-constrained columns (User.email, Repository.githubId, Commit.sha) need
// distinct values per row. Tables are truncated between tests, so a per-process
// counter is enough; it never has to survive a run.
let sequence = 0;
const nextId = () => (sequence += 1);

export const TEST_PASSWORD = 'password123';

export const createUser = async (overrides = {}) => {
  const n = nextId();
  const { password = TEST_PASSWORD, ...rest } = overrides;

  return prisma.user.create({
    data: {
      email: `user${n}@test.devpulse.ai`,
      passwordHash: await bcrypt.hash(password, 4), // low cost: these are throwaway
      ...rest,
    },
  });
};

/** A user plus a signed JWT, for tests that need an authenticated request. */
export const createAuthedUser = async (overrides = {}) => {
  const user = await createUser(overrides);
  const token = generateToken(user);
  return { user, token, authHeader: `Bearer ${token}` };
};

export const createRepository = async (userId, overrides = {}) => {
  const n = nextId();

  return prisma.repository.create({
    data: {
      userId,
      githubId: 100000 + n,
      name: `repo-${n}`,
      fullName: `testuser/repo-${n}`,
      language: 'JavaScript',
      ...overrides,
    },
  });
};

export const createPullRequest = async (repositoryId, overrides = {}) => {
  const n = nextId();

  return prisma.pullRequest.create({
    data: {
      repositoryId,
      githubPrId: 200000 + n,
      number: n,
      title: `Test PR ${n}`,
      state: 'open',
      authorLogin: 'testuser',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    },
  });
};

export const createCommit = async (repositoryId, overrides = {}) => {
  const n = nextId();

  return prisma.commit.create({
    data: {
      repositoryId,
      sha: `sha${String(n).padStart(37, '0')}`,
      message: `feat: test commit ${n}`,
      authorLogin: 'testuser',
      committedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    },
  });
};

export const createNotification = async (userId, overrides = {}) => {
  const n = nextId();

  return prisma.notification.create({
    data: {
      userId,
      type: 'sync_complete',
      title: `Test notification ${n}`,
      body: 'Test notification body',
      ...overrides,
    },
  });
};

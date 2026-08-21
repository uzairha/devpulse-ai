import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_EMAIL = 'test@devpulse.ai';

async function main() {
  if (process.argv.includes('--reset')) {
    // Deletes the seeded user; onDelete: Cascade on every downstream relation
    // (Repository -> SyncJob/PullRequest/Commit/WeeklyReport, User -> Notification)
    // takes care of the rest. Scoped to this one seed email, not a full DB wipe.
    const { count } = await prisma.user.deleteMany({ where: { email: SEED_EMAIL } });
    if (count > 0) console.log(`Reset: removed existing seed user and all related data`);
  }

  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    update: {},
    create: {
      email: SEED_EMAIL,
      passwordHash,
      githubUsername: 'testuser',
    },
  });

  console.log('Seeded user:', user.email);

  const repos = [
    {
      githubId: 100001,
      name: 'api-service',
      fullName: 'testuser/api-service',
      description: 'Main backend API service',
      language: 'JavaScript',
    },
    {
      githubId: 100002,
      name: 'frontend-app',
      fullName: 'testuser/frontend-app',
      description: 'React frontend application',
      language: 'TypeScript',
    },
  ];

  for (const repoData of repos) {
    const repo = await prisma.repository.upsert({
      where: { githubId: repoData.githubId },
      update: {},
      create: { ...repoData, userId: user.id },
    });

    console.log('Seeded repo:', repo.fullName);

    // Seed 10 pull requests per repo
    for (let i = 1; i <= 10; i++) {
      const createdAt = new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000);
      const mergedAt = i % 3 !== 0 ? new Date(createdAt.getTime() + i * 4 * 60 * 60 * 1000) : null;
      const reviewCount = Math.floor(Math.random() * 3);
      // First review lands a few hours after PR open, always before merge if merged.
      const firstReviewAt =
        reviewCount > 0
          ? new Date(createdAt.getTime() + (1 + Math.random() * 20) * 60 * 60 * 1000)
          : null;

      await prisma.pullRequest.upsert({
        where: { repositoryId_githubPrId: { repositoryId: repo.id, githubPrId: i } },
        update: {},
        create: {
          repositoryId: repo.id,
          githubPrId: i,
          number: i,
          title: `feat: add feature ${i} to ${repo.name}`,
          state: mergedAt ? 'merged' : 'open',
          authorLogin: 'testuser',
          createdAt,
          mergedAt,
          additions: Math.floor(Math.random() * 200) + 10,
          deletions: Math.floor(Math.random() * 50) + 5,
          changedFiles: Math.floor(Math.random() * 10) + 1,
          reviewCount,
          commentCount: Math.floor(Math.random() * 8),
          firstReviewAt,
        },
      });
    }

    // Seed 20 commits per repo — mix of conventional-commit-compliant and plain
    // messages so the commit-message-compliance metric has something to show.
    const commitMessageFor = (i) => {
      const messages = [
        `feat: add feature ${i} to ${repo.name}`,
        `fix: correct bug in module ${i}`,
        `chore: bump dependency ${i}`,
        `docs: update readme section ${i}`,
        `refactor: simplify handler ${i}`,
        `Updated stuff ${i}`,
        `WIP ${i}`,
        `fixed the thing`,
      ];
      return messages[i % messages.length];
    };

    // Seed 20 commits per repo
    for (let i = 1; i <= 20; i++) {
      const sha = `abc${repoData.githubId}${String(i).padStart(4, '0')}def`;
      const message = commitMessageFor(i);

      await prisma.commit.upsert({
        where: { sha },
        update: {},
        create: {
          repositoryId: repo.id,
          sha,
          message,
          authorLogin: 'testuser',
          authorEmail: 'test@devpulse.ai',
          committedAt: new Date(Date.now() - i * 1.5 * 24 * 60 * 60 * 1000),
          additions: Math.floor(Math.random() * 100) + 5,
          deletions: Math.floor(Math.random() * 30) + 1,
        },
      });
    }

    console.log(`Seeded 10 PRs and 20 commits for ${repo.fullName}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

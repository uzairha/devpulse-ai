import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'test@devpulse.ai' },
    update: {},
    create: {
      email: 'test@devpulse.ai',
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
          reviewCount: Math.floor(Math.random() * 3),
          commentCount: Math.floor(Math.random() * 8),
        },
      });
    }

    // Seed 20 commits per repo
    for (let i = 1; i <= 20; i++) {
      const sha = `abc${repoData.githubId}${String(i).padStart(4, '0')}def`;
      await prisma.commit.upsert({
        where: { sha },
        update: {},
        create: {
          repositoryId: repo.id,
          sha,
          message: `chore: commit ${i} for ${repo.name}`,
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

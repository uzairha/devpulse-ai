import { chat } from '../lib/openai.js';
import prisma from '../lib/prisma.js';

const SYSTEM_PR_SUMMARY = `You are a senior engineer writing concise PR summaries for a developer analytics dashboard.
Given PR metadata, write a 2–3 sentence summary covering: what changed, the scope of the change, and any notable signals (review activity, merge time, churn).
Be direct. No filler phrases like "This PR" or "Overall". Output plain text only.`;

export const generatePrSummary = async (pr) => {
  const mergeTimeHours = pr.mergedAt
    ? Math.round((new Date(pr.mergedAt) - new Date(pr.createdAt)) / 3600000)
    : null;

  const userPrompt = `
PR #${pr.number}: "${pr.title}"
Author: ${pr.authorLogin}
State: ${pr.mergedAt ? 'merged' : pr.state}
${mergeTimeHours != null ? `Time to merge: ${mergeTimeHours}h` : ''}
Changes: +${pr.additions} / -${pr.deletions} across ${pr.changedFiles} files
Reviews: ${pr.reviewCount} | Comments: ${pr.commentCount}
Created: ${new Date(pr.createdAt).toDateString()}
`.trim();

  return chat(SYSTEM_PR_SUMMARY, userPrompt, { maxTokens: 200 });
};

export const generateWeeklyReport = async (repositoryId) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [prs, commits] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId, createdAt: { gte: sevenDaysAgo } },
      select: {
        number: true, title: true, state: true, authorLogin: true,
        mergedAt: true, additions: true, deletions: true, reviewCount: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.commit.findMany({
      where: { repositoryId, committedAt: { gte: sevenDaysAgo } },
      select: { message: true, authorLogin: true, additions: true, deletions: true },
      orderBy: { committedAt: 'desc' },
      take: 30,
    }),
  ]);

  const repo = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { fullName: true },
  });

  const merged = prs.filter((p) => p.mergedAt);
  const open = prs.filter((p) => p.state === 'open');
  const authors = [...new Set(commits.map((c) => c.authorLogin).filter(Boolean))];
  const totalLines = commits.reduce((s, c) => s + c.additions + c.deletions, 0);

  const prList = prs
    .slice(0, 10)
    .map((p) => `  - #${p.number} "${p.title}" by ${p.authorLogin} (${p.mergedAt ? 'merged' : p.state})`)
    .join('\n');

  const commitSample = commits
    .slice(0, 10)
    .map((c) => `  - "${c.message.split('\n')[0].slice(0, 60)}" by ${c.authorLogin ?? 'unknown'}`)
    .join('\n');

  const systemPrompt = `You are an engineering manager writing a concise weekly digest for a developer analytics platform.
Write in clear, direct prose. Use short paragraphs. No bullet lists. No headers. 3–4 paragraphs max.
Focus on: what shipped, who contributed, any patterns or signals worth noting.`;

  const userPrompt = `Repository: ${repo.fullName}
Period: last 7 days

Pull Requests (${prs.length} total, ${merged.length} merged, ${open.length} open):
${prList || '  None'}

Commits (${commits.length} total by ${authors.length} contributors, ${totalLines} lines changed):
${commitSample || '  None'}

Write the weekly engineering digest.`;

  return chat(systemPrompt, userPrompt, { maxTokens: 600 });
};

export const chatWithRepoData = async (repositoryId, question, history = []) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [repo, prMetrics, commitCount, topAuthors] = await Promise.all([
    prisma.repository.findUnique({ where: { id: repositoryId }, select: { fullName: true, lastSyncAt: true } }),
    prisma.pullRequest.aggregate({
      where: { repositoryId, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      _avg: { reviewCount: true },
    }),
    prisma.commit.count({ where: { repositoryId, committedAt: { gte: thirtyDaysAgo } } }),
    prisma.commit.groupBy({
      by: ['authorLogin'],
      where: { repositoryId, committedAt: { gte: thirtyDaysAgo }, authorLogin: { not: null } },
      _count: { sha: true },
      orderBy: { _count: { sha: 'desc' } },
      take: 5,
    }),
  ]);

  const context = `Repository: ${repo.fullName}
Last synced: ${repo.lastSyncAt ? new Date(repo.lastSyncAt).toDateString() : 'never'}
Last 30 days:
- Pull requests: ${prMetrics._count}
- Avg reviews per PR: ${prMetrics._avg.reviewCount?.toFixed(1) ?? 0}
- Commits: ${commitCount}
- Top contributors: ${topAuthors.map((a) => `${a.authorLogin} (${a._count.sha} commits)`).join(', ') || 'none'}`;

  const systemPrompt = `You are a developer analytics assistant. Answer questions about the repository using the data provided.
Be concise and specific. If the data doesn't support an answer, say so honestly.
Context:\n${context}`;

  const fullQuestion = history.length > 0
    ? `Previous conversation:\n${history.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n')}\n\nQuestion: ${question}`
    : question;

  return chat(systemPrompt, fullQuestion, { maxTokens: 400 });
};

export const calculateHealthScore = async (repositoryId) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [prs, commits, failedSyncs] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { repositoryId, createdAt: { gte: thirtyDaysAgo } },
      select: { state: true, mergedAt: true, createdAt: true, reviewCount: true },
    }),
    prisma.commit.count({ where: { repositoryId, committedAt: { gte: thirtyDaysAgo } } }),
    prisma.syncJob.count({ where: { repositoryId, status: 'failed' } }),
  ]);

  // Score components (each out of 100, weighted)
  const scores = [];

  // 1. Merge rate (25 pts) — % of closed PRs that were merged
  const closedPrs = prs.filter((p) => p.state === 'closed' || p.mergedAt);
  const mergedPrs = prs.filter((p) => p.mergedAt);
  const mergeRate = closedPrs.length > 0 ? mergedPrs.length / closedPrs.length : 1;
  scores.push({ value: mergeRate * 100, weight: 0.25 });

  // 2. Review coverage (25 pts) — % of PRs with at least one review
  const reviewedPrs = prs.filter((p) => p.reviewCount > 0);
  const reviewRate = prs.length > 0 ? reviewedPrs.length / prs.length : 1;
  scores.push({ value: reviewRate * 100, weight: 0.25 });

  // 3. Commit frequency (25 pts) — 30+ commits/month = full score
  const commitScore = Math.min(commits / 30, 1) * 100;
  scores.push({ value: commitScore, weight: 0.25 });

  // 4. Avg time to merge (25 pts) — under 24h = full, over 168h (1 week) = 0
  const mergeTimes = mergedPrs
    .map((p) => (new Date(p.mergedAt) - new Date(p.createdAt)) / 3600000)
    .filter((h) => h > 0);
  const avgMergeHours =
    mergeTimes.length > 0 ? mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length : 48;
  const mergeTimeScore = Math.max(0, Math.min(1, 1 - (avgMergeHours - 24) / 144)) * 100;
  scores.push({ value: mergeTimeScore, weight: 0.25 });

  const total = Math.round(scores.reduce((sum, s) => sum + s.value * s.weight, 0));

  return {
    score: total,
    breakdown: {
      mergeRate: Math.round(mergeRate * 100),
      reviewCoverage: Math.round(reviewRate * 100),
      commitFrequency: Math.round(commitScore),
      mergeSpeed: Math.round(mergeTimeScore),
    },
    meta: { totalPrs: prs.length, commits, failedSyncs },
  };
};

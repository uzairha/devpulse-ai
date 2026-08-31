import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same policy as ai.test.js: only the OpenAI boundary is mocked. This suite
// is the "consumption end" counterpart to the scheduling assertions already
// covered elsewhere — it calls the worker's job processor directly rather
// than running a real BullMQ Worker consumer, so runs are deterministic.
vi.mock('../lib/openai.js', () => ({
  chat: vi.fn(),
}));

const { chat } = await import('../lib/openai.js');
const { processWeeklyReports } = await import('./reportWorker.js');
const { default: prisma } = await import('../lib/prisma.js');
const { createUser, createRepository } = await import('../test/factories.js');

beforeEach(() => {
  vi.clearAllMocks();
  // The prompt names the repo (see aiService.generateWeeklyReport's userPrompt),
  // so a repo's fullName is used as the failure trigger below — deterministic
  // regardless of the order repositories.findMany returns them in.
  chat.mockImplementation((systemPrompt, userPrompt) =>
    userPrompt.includes('fail-repo')
      ? Promise.reject(new Error('LLM is down'))
      : Promise.resolve('Mocked weekly report.')
  );
});

describe('processWeeklyReports', () => {
  it('generates, persists and notifies for a repo whose owner opted in', async () => {
    const user = await createUser({ weeklyReportEmail: true });
    const repo = await createRepository(user.id, { fullName: 'testuser/opted-in' });

    await processWeeklyReports();

    const reports = await prisma.weeklyReport.findMany({ where: { repositoryId: repo.id } });
    expect(reports).toHaveLength(1);
    expect(reports[0].content).toBe('Mocked weekly report.');

    const notifs = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({ type: 'weekly_report', link: `/reports?repo=${repo.id}` });
  });

  it('skips repos whose owner has weeklyReportEmail disabled', async () => {
    const user = await createUser({ weeklyReportEmail: false });
    const repo = await createRepository(user.id);

    await processWeeklyReports();

    expect(await prisma.weeklyReport.count({ where: { repositoryId: repo.id } })).toBe(0);
    expect(chat).not.toHaveBeenCalled();
  });

  it('generates a separate report for each repo an opted-in owner has', async () => {
    const user = await createUser({ weeklyReportEmail: true });
    const repoA = await createRepository(user.id, { fullName: 'testuser/repo-a' });
    const repoB = await createRepository(user.id, { fullName: 'testuser/repo-b' });

    await processWeeklyReports();

    expect(await prisma.weeklyReport.count({ where: { repositoryId: repoA.id } })).toBe(1);
    expect(await prisma.weeklyReport.count({ where: { repositoryId: repoB.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(2);
  });

  it('continues processing other repos when one report generation fails', async () => {
    const user = await createUser({ weeklyReportEmail: true });
    const failing = await createRepository(user.id, { fullName: 'testuser/fail-repo' });
    const ok = await createRepository(user.id, { fullName: 'testuser/ok-repo' });

    await processWeeklyReports();

    expect(await prisma.weeklyReport.count({ where: { repositoryId: failing.id } })).toBe(0);
    expect(await prisma.weeklyReport.count({ where: { repositoryId: ok.id } })).toBe(1);
    // The failing repo's owner gets no notification for that repo's report,
    // but the successful repo still produces one.
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  it('does nothing when no user has weekly reports enabled', async () => {
    await createUser({ weeklyReportEmail: false });

    await expect(processWeeklyReports()).resolves.toBeUndefined();
    expect(chat).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const { default: api } = await import('../services/api');
const { default: RepoDetailPage } = await import('./RepoDetailPage.jsx');

const analytics = (overrides = {}) => ({
  prMetrics: {
    total: 15, merged: 10, mergeRate: 66, open: 3,
    avgTimeToMergeHours: 20, avgReviewCount: 1.2, avgReviewTurnaroundHours: 7,
    totalAdditions: 2000, totalDeletions: 500,
    weeklyThroughput: [{ weekStart: '2026-01-05', count: 3 }],
    sizeBreakdown: [{ label: 'S', count: 4 }],
  },
  commitMetrics: {
    total: 60, contributorCount: 3, complianceRate: 72,
    totalAdditions: 3000, totalDeletions: 900,
    dailyActivity: [{ date: '2026-01-10', count: 5 }],
    typeBreakdown: [{ type: 'fix', count: 6 }],
  },
  trends: {}, leaderboard: [], activityHeatmap: [], stalePrs: [],
  startDate: '2026-01-01', endDate: '2026-01-31',
  repo: { fullName: 'octo/api', lastSyncAt: '2026-01-12T00:00:00Z' },
  ...overrides,
});

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/repos/r1']}>
      <Routes>
        <Route path="/repos/:id" element={<RepoDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/analytics/r1?')) return Promise.resolve({ data: analytics() });
    if (url.startsWith('/ai/health-score/')) return Promise.resolve({ data: { score: 81, breakdown: { mergeRate: 80, reviewCoverage: 90 } } });
    if (url.startsWith('/analytics/r1/prs')) return Promise.resolve({ data: { data: [], total: 0, pages: 0 } });
    if (url.startsWith('/analytics/r1/commits')) return Promise.resolve({ data: { data: [], total: 0, pages: 0 } });
    return Promise.reject(new Error('unexpected ' + url));
  });
});

describe('RepoDetailPage', () => {
  it('renders the overview with the repo name, PR metrics and health score', async () => {
    renderAt();
    expect(await screen.findByText('octo/api')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pull Requests' })).toBeInTheDocument();
    expect(screen.getByText('Total PRs')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(await screen.findByText('81')).toBeInTheDocument(); // health score
  });

  it('warns when the repo has never been synced', async () => {
    api.get.mockImplementation((url) =>
      url.startsWith('/analytics/r1?')
        ? Promise.resolve({ data: analytics({ repo: { fullName: 'octo/api', lastSyncAt: null } }) })
        : Promise.resolve({ data: { score: 50, breakdown: {} } })
    );
    renderAt();
    expect(await screen.findByText(/No data yet/)).toBeInTheDocument();
  });

  it('shows the error banner when analytics fails to load', async () => {
    api.get.mockImplementation((url) =>
      url.startsWith('/analytics/r1?') ? Promise.reject(new Error('nope')) : Promise.resolve({ data: {} })
    );
    renderAt();
    expect(await screen.findByText('nope')).toBeInTheDocument();
  });

  it('switches to the Pull Requests tab and mounts the PR table', async () => {
    renderAt();
    await screen.findByText('octo/api');

    fireEvent.click(screen.getByRole('button', { name: 'Pull requests' }));
    await screen.findByText(/No pull requests found/);
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/analytics/r1/prs'));
  });

  it('switches to the Chat tab and shows the assistant intro', async () => {
    renderAt();
    await screen.findByText('octo/api');

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(screen.getByText(/Ask me anything about this repository/)).toBeInTheDocument();
  });
});

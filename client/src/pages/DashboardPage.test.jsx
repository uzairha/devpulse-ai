import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
const mockUser = { githubUsername: 'octocat' };
vi.mock('../hooks/useAuth', () => ({ default: () => ({ user: mockUser }) }));

const { default: api } = await import('../services/api');
const { default: DashboardPage } = await import('./DashboardPage.jsx');

const analytics = (overrides = {}) => ({
  prMetrics: {
    total: 42,
    merged: 30,
    mergeRate: 71,
    open: 5,
    avgTimeToMergeHours: 18,
    avgReviewCount: 1.4,
    avgReviewTurnaroundHours: 6,
    totalAdditions: 5000,
    totalDeletions: 1200,
    weeklyThroughput: [
      { weekStart: '2026-01-05', count: 4 },
      { weekStart: '2026-01-12', count: 7 },
    ],
  },
  commitMetrics: {
    total: 120,
    contributorCount: 6,
    complianceRate: 68,
    totalAdditions: 8000,
    totalDeletions: 2000,
    dailyActivity: [
      { date: '2026-01-10', count: 3 },
      { date: '2026-01-11', count: 9 },
    ],
    typeBreakdown: [{ type: 'feat', count: 10 }],
  },
  trends: {},
  leaderboard: [],
  activityHeatmap: [],
  stalePrs: [],
  repo: { fullName: 'octo/api', lastSyncAt: '2026-01-12T00:00:00Z' },
  ...overrides,
});

const route = (impl) => {
  api.get.mockImplementation((url) => impl(url));
};

const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('shows onboarding steps when the user has no repositories', async () => {
    route((url) => (url === '/repos' ? Promise.resolve({ data: [] }) : Promise.reject(new Error('x'))));
    renderPage();
    expect(await screen.findByText('Get started with DevPulse AI')).toBeInTheDocument();
  });

  it('renders the Pull Requests metrics once a repo and its analytics load', async () => {
    route((url) => {
      if (url === '/repos') return Promise.resolve({ data: [{ id: 'r1', fullName: 'octo/api' }] });
      if (url.startsWith('/analytics/r1')) return Promise.resolve({ data: analytics() });
      return Promise.reject(new Error('unexpected ' + url));
    });
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Pull Requests' })).toBeInTheDocument();
    expect(screen.getByText('Total PRs')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByText(/No data yet/)).not.toBeInTheDocument();
  });

  it('warns when the selected repo has never been synced', async () => {
    route((url) => {
      if (url === '/repos') return Promise.resolve({ data: [{ id: 'r1', fullName: 'octo/api' }] });
      if (url.startsWith('/analytics/r1'))
        return Promise.resolve({ data: analytics({ repo: { fullName: 'octo/api', lastSyncAt: null } }) });
      return Promise.reject(new Error('unexpected ' + url));
    });
    renderPage();
    expect(await screen.findByText(/No data yet/)).toBeInTheDocument();
  });

  it('shows the error banner when the analytics request fails', async () => {
    route((url) => {
      if (url === '/repos') return Promise.resolve({ data: [{ id: 'r1', fullName: 'octo/api' }] });
      return Promise.reject(new Error('analytics down'));
    });
    renderPage();
    expect(await screen.findByText('analytics down')).toBeInTheDocument();
  });
});

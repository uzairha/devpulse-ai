import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
const { default: api } = await import('../services/api');
const { default: ComparePage } = await import('./ComparePage.jsx');

const renderPage = () => render(<MemoryRouter><ComparePage /></MemoryRouter>);

const payload = {
  repos: [
    {
      repo: { id: 'r1', fullName: 'octo/api' },
      healthScore: 82,
      prCount: 20,
      mergedCount: 16,
      mergeRate: 80,
      avgTimeToMergeHours: 12,
      avgReviewTurnaroundHours: 5,
      commitCount: 90,
      contributorCount: 4,
      commitComplianceRate: 70,
      additions: 1000,
      deletions: 200,
    },
    {
      repo: { id: 'r2', fullName: 'octo/web' },
      healthScore: 40,
      prCount: 3,
      mergedCount: 1,
      mergeRate: 33,
      avgTimeToMergeHours: null,
      avgReviewTurnaroundHours: null,
      commitCount: 0,
      contributorCount: 0,
      commitComplianceRate: 0,
      additions: 10,
      deletions: 0,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ComparePage', () => {
  it('shows a loading indicator until the request resolves', () => {
    api.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders a row per repo with health, PR counts and merge rate', async () => {
    api.get.mockResolvedValue({ data: payload });
    renderPage();

    expect(await screen.findByRole('link', { name: 'octo/api' })).toHaveAttribute('href', '/repos/r1');
    expect(screen.getByText('16 / 20')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    // repo with no commits shows an em dash for compliance
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the empty state when no repos are connected', async () => {
    api.get.mockResolvedValue({ data: { repos: [] } });
    renderPage();
    expect(await screen.findByText(/No repositories connected/)).toBeInTheDocument();
  });

  it('surfaces the error message when the request fails', async () => {
    api.get.mockRejectedValue(new Error('Server exploded'));
    renderPage();
    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
  });
});

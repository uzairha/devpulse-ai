import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const { default: api } = await import('../services/api');
const { default: ContributorDetailPage } = await import('./ContributorDetailPage.jsx');

const summary = {
  repo: { fullName: 'octo/api' },
  prCount: 9,
  mergedPrCount: 7,
  mergeRate: 77,
  avgTimeToMergeHours: 14,
  avgReviewTurnaroundHours: 4,
  commitCount: 33,
  totalAdditions: 1200,
  totalDeletions: 300,
  trends: {},
};

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/repos/r1/contributors/alice']}>
      <Routes>
        <Route path="/repos/:id/contributors/:login" element={<ContributorDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url.includes('/contributors/alice')) return Promise.resolve({ data: summary });
    if (url.includes('/prs')) return Promise.resolve({ data: { data: [], total: 0, pages: 0 } });
    if (url.includes('/commits')) return Promise.resolve({ data: { data: [], total: 0, pages: 0 } });
    return Promise.reject(new Error('unexpected ' + url));
  });
});

describe('ContributorDetailPage', () => {
  it('renders the contributor breadcrumb and their metric cards', async () => {
    renderAt();
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument(); // PR count
    expect(screen.getByText('33')).toBeInTheDocument(); // commit count
    expect(screen.getByText('77% merge rate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commits' })).toBeInTheDocument(); // tab
  });

  it('loads the PR table scoped to this author by default', async () => {
    renderAt();
    await screen.findByText('alice');
    await screen.findByText(/No pull requests found/);
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('author=alice'));
  });

  it('switches to the Commits tab', async () => {
    renderAt();
    await screen.findByText('alice');

    fireEvent.click(screen.getByRole('button', { name: 'Commits' }));
    await screen.findByText(/No commits found/);
  });

  it('shows the error banner when the contributor summary fails', async () => {
    api.get.mockImplementation((url) =>
      url.includes('/contributors/alice') ? Promise.reject(new Error('gone')) : Promise.resolve({ data: {} })
    );
    renderAt();
    expect(await screen.findByText('gone')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const { default: api } = await import('../services/api');
const { PrStatusBadge, Pagination, PrTable, CommitTable } = await import('./RepoTables.jsx');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PrStatusBadge', () => {
  it('shows Merged when mergedAt is set, regardless of state', () => {
    render(<PrStatusBadge state="closed" mergedAt="2026-01-02T00:00:00Z" />);
    expect(screen.getByText('Merged')).toHaveClass('pr-badge--merged');
  });

  it('shows Open for an open, unmerged PR', () => {
    render(<PrStatusBadge state="open" mergedAt={null} />);
    expect(screen.getByText('Open')).toHaveClass('pr-badge--open');
  });

  it('shows Closed for a closed, unmerged PR', () => {
    render(<PrStatusBadge state="closed" mergedAt={null} />);
    expect(screen.getByText('Closed')).toHaveClass('pr-badge--closed');
  });
});

describe('Pagination', () => {
  it('renders nothing when there is one page or fewer', () => {
    const { container } = render(<Pagination page={1} pages={1} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the current page and total, with both arrows enabled in the middle', () => {
    render(<Pagination page={2} pages={3} onPage={() => {}} />);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '←' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '→' })).toBeEnabled();
  });

  it('disables the previous arrow on the first page and the next arrow on the last', () => {
    const { rerender } = render(<Pagination page={1} pages={3} onPage={() => {}} />);
    expect(screen.getByRole('button', { name: '←' })).toBeDisabled();

    rerender(<Pagination page={3} pages={3} onPage={() => {}} />);
    expect(screen.getByRole('button', { name: '→' })).toBeDisabled();
  });

  it('calls onPage with the adjacent page number when an arrow is clicked', () => {
    const onPage = vi.fn();
    render(<Pagination page={2} pages={3} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: '←' }));
    fireEvent.click(screen.getByRole('button', { name: '→' }));
    expect(onPage).toHaveBeenNthCalledWith(1, 1);
    expect(onPage).toHaveBeenNthCalledWith(2, 3);
  });
});

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PrTable', () => {
  it('renders a row per PR returned by the analytics endpoint', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [
          { id: 'p1', number: 12, title: 'Add login', state: 'open', additions: 5, deletions: 1, createdAt: '2026-01-01T00:00:00Z', authorLogin: 'alice' },
        ],
        total: 1,
        pages: 1,
      },
    });
    renderInRouter(<PrTable repoId="r1" />);
    expect(await screen.findByText('Add login')).toBeInTheDocument();
    expect(screen.getByText('#12')).toBeInTheDocument();
  });

  it('shows the empty state when the repo has no PRs', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0, pages: 0 } });
    renderInRouter(<PrTable repoId="r1" />);
    expect(await screen.findByText(/No pull requests found/)).toBeInTheDocument();
  });

  it('refetches with a state filter when a status tab is clicked', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0, pages: 0 } });
    renderInRouter(<PrTable repoId="r1" />);
    await screen.findByText(/No pull requests found/);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('state=open'));
  });
});

describe('CommitTable', () => {
  it('renders the short SHA and first message line for each commit', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [
          { id: 'c1', sha: 'abcdef1234567', message: 'fix: thing\n\nbody', additions: 2, deletions: 0, committedAt: '2026-01-01T00:00:00Z', authorLogin: 'bob' },
        ],
        total: 1,
        pages: 1,
      },
    });
    renderInRouter(<CommitTable repoId="r1" />);
    expect(await screen.findByText('abcdef1')).toBeInTheDocument();
    expect(screen.getByText('fix: thing')).toBeInTheDocument();
  });

  it('shows the empty state when there are no commits', async () => {
    api.get.mockResolvedValue({ data: { data: [], total: 0, pages: 0 } });
    renderInRouter(<CommitTable repoId="r1" />);
    expect(await screen.findByText(/No commits found/)).toBeInTheDocument();
  });
});

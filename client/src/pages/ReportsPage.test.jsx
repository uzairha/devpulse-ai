import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const { default: api } = await import('../services/api');
const { default: ReportsPage } = await import('./ReportsPage.jsx');

const repos = [
  { id: 'r1', fullName: 'octo/api' },
  { id: 'r2', fullName: 'octo/web' },
];

const renderAt = (path = '/reports') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ReportsPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) => {
    if (url === '/repos') return Promise.resolve({ data: repos });
    if (url.includes('/history')) return Promise.resolve({ data: [] });
    return Promise.reject(new Error('unexpected ' + url));
  });
});

describe('ReportsPage', () => {
  it('shows the empty state when there are no repos', async () => {
    api.get.mockResolvedValueOnce({ data: [] });
    renderAt();
    expect(await screen.findByText(/No repositories connected/)).toBeInTheDocument();
  });

  it('renders the repo picker and the generate prompt once repos load', async () => {
    renderAt();
    expect(await screen.findByRole('button', { name: /Generate weekly report/ })).toBeInTheDocument();
    expect(screen.getByText(/Select a repository and click/)).toBeInTheDocument();
  });

  it('generates a report and renders its body', async () => {
    api.post.mockResolvedValue({
      data: { report: 'Line one.\n\nLine two.', generatedAt: '2026-01-12T09:00:00Z', repoFullName: 'octo/api' },
    });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /Generate weekly report/ }));

    expect(await screen.findByText('Line one.')).toBeInTheDocument();
    expect(screen.getByText('Line two.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ai/weekly-report/r1');
  });

  it('shows an error when generation fails', async () => {
    api.post.mockRejectedValue(new Error('LLM unavailable'));
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /Generate weekly report/ }));
    expect(await screen.findByText('LLM unavailable')).toBeInTheDocument();
  });

  it('auto-selects and shows the latest report when linked with ?repo=', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/repos') return Promise.resolve({ data: repos });
      if (url.includes('/weekly-report/r2/history'))
        return Promise.resolve({
          data: [{ id: 'h1', content: 'Auto digest.', createdAt: '2026-01-12T09:00:00Z', periodStart: '2026-01-05', periodEnd: '2026-01-12' }],
        });
      return Promise.resolve({ data: [] });
    });
    renderAt('/reports?repo=r2');

    expect(await screen.findByText('Auto digest.')).toBeInTheDocument();
    expect(screen.getByText('Past reports')).toBeInTheDocument();
  });
});

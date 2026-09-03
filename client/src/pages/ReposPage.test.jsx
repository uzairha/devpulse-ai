import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
const { default: api } = await import('../services/api');
const { default: ReposPage } = await import('./ReposPage.jsx');

const connected = [
  { id: 'r1', fullName: 'octo/api', lastSyncAt: '2026-01-10T00:00:00Z', webhookId: 'w1', activitySparkline: [], lastActivityAt: null },
];
const available = [
  { githubId: 111, fullName: 'octo/new-thing', description: 'a fresh repo', private: false },
];

const renderPage = () => render(<MemoryRouter><ReposPage /></MemoryRouter>);

const happyPath = () => {
  api.get.mockImplementation((url) => {
    if (url === '/repos') return Promise.resolve({ data: connected });
    if (url === '/repos/available') return Promise.resolve({ data: available });
    return Promise.reject(new Error('unexpected ' + url));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReposPage', () => {
  it('lists connected repos with a count and the available repos to add', async () => {
    happyPath();
    renderPage();

    expect(await screen.findByRole('link', { name: 'octo/api' })).toHaveAttribute('href', '/repos/r1');
    expect(screen.getByText('octo/new-thing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument();
  });

  it('filters the available list by the search box', async () => {
    happyPath();
    renderPage();
    await screen.findByText('octo/new-thing');

    fireEvent.change(screen.getByPlaceholderText('Search repositories…'), { target: { value: 'nothing-matches' } });
    expect(screen.getByText('No repositories match your search.')).toBeInTheDocument();
  });

  it('connects an available repo through POST /repos', async () => {
    happyPath();
    api.post.mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/repos', { githubRepoId: 111 }));
  });

  it('asks for confirmation before disconnecting, then calls DELETE', async () => {
    happyPath();
    api.delete.mockResolvedValue({});
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

    const modal = (await screen.findByText('Disconnect octo/api?')).closest('.confirm-modal');
    fireEvent.click(within(modal).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/repos/r1'));
  });

  it('shows an error if the connected list fails to load', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/repos') return Promise.reject(new Error('boom'));
      return Promise.resolve({ data: [] });
    });
    renderPage();
    expect(await screen.findByText('Failed to load connected repositories.')).toBeInTheDocument();
  });
});

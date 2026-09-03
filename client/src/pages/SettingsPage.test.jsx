import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockLogout = vi.fn();
const mockToggleTheme = vi.fn();
let mockUser = { email: 'me@test.dev', githubUsername: 'octocat', weeklyReportEmail: true, syncNotifications: true };
let mockTheme = 'light';

vi.mock('../hooks/useAuth', () => ({ default: () => ({ user: mockUser, logout: mockLogout }) }));
vi.mock('../hooks/useTheme', () => ({ default: () => ({ theme: mockTheme, toggleTheme: mockToggleTheme }) }));
vi.mock('../services/api', () => ({ default: { patch: vi.fn() } }));

const { default: api } = await import('../services/api');
const { default: SettingsPage } = await import('./SettingsPage.jsx');

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { email: 'me@test.dev', githubUsername: 'octocat', weeklyReportEmail: true, syncNotifications: true };
  mockTheme = 'light';
});

describe('SettingsPage', () => {
  it('shows the account email and the connected GitHub handle', () => {
    render(<SettingsPage />);
    expect(screen.getByText('me@test.dev')).toBeInTheDocument();
    expect(screen.getByText('@octocat connected')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Connect GitHub' })).not.toBeInTheDocument();
  });

  it('offers a Connect GitHub link when no GitHub account is linked', () => {
    mockUser = { email: 'me@test.dev' };
    render(<SettingsPage />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect GitHub' })).toHaveAttribute('href', '/api/auth/github');
  });

  it('reflects the current theme on the dark-mode toggle and calls toggleTheme on change', () => {
    mockTheme = 'dark';
    render(<SettingsPage />);
    const darkToggle = screen.getByText('Dark mode').closest('.settings-row').querySelector('input');
    expect(darkToggle).toBeChecked();
    fireEvent.click(darkToggle);
    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });

  it('saves notification preferences and shows a confirmation', async () => {
    api.patch.mockResolvedValue({});
    render(<SettingsPage />);

    fireEvent.click(screen.getByText('Weekly reports').closest('.settings-row').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => expect(screen.getByText('Preferences saved.')).toBeInTheDocument());
    expect(api.patch).toHaveBeenCalledWith('/auth/settings', {
      weeklyReportEmail: false,
      syncNotifications: true,
    });
  });

  it('surfaces a save failure', async () => {
    api.patch.mockRejectedValue(new Error('nope'));
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await waitFor(() => expect(screen.getByText('nope')).toBeInTheDocument());
  });

  it('signs out via the auth context', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(mockLogout).toHaveBeenCalledOnce();
  });
});

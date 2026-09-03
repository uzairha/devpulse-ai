import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('../hooks/useAuth', () => ({ default: () => ({ login: vi.fn() }) }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const { default: AuthCallbackPage } = await import('./AuthCallbackPage.jsx');

let originalLocation;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  originalLocation = window.location;
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

const renderAt = (search) =>
  render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <AuthCallbackPage />
    </MemoryRouter>
  );

describe('AuthCallbackPage', () => {
  it('stores the token from the query string and redirects to the dashboard', () => {
    renderAt('?token=jwt-123');
    expect(localStorage.getItem('token')).toBe('jwt-123');
    expect(window.location.href).toBe('/dashboard');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to the login page with an error when no token is present', () => {
    renderAt('');
    expect(localStorage.getItem('token')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login?error=oauth_failed');
  });

  it('shows a signing-in message while it works', () => {
    renderAt('?token=jwt-123');
    expect(screen.getByText('Signing you in...')).toBeInTheDocument();
  });
});

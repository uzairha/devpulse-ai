import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// The shared axios instance is the outbound-HTTP boundary for the client,
// same role githubApiService/openai.js play on the server: mock it here so
// no test ever fires a real request, and everything downstream (AuthContext,
// and later any page built on useAuth) gets exercised against a stub instead.
vi.mock('../services/api.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const { default: api } = await import('../services/api.js');
const { AuthProvider } = await import('./AuthContext.jsx');
const { default: useAuth } = await import('../hooks/useAuth.js');

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useAuth outside a provider', () => {
  it('throws rather than silently returning an unauthenticated context', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider');
  });
});

describe('AuthProvider initial load', () => {
  it('finishes loading with no user when there is no stored token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('loads the user from /auth/me when a token is stored', async () => {
    localStorage.setItem('token', 'valid-token');
    api.get.mockResolvedValue({ data: { id: 'u1', email: 'a@test.dev' } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(result.current.user).toEqual({ id: 'u1', email: 'a@test.dev' });
  });

  it('clears a stored token that /auth/me rejects', async () => {
    localStorage.setItem('token', 'stale-token');
    api.get.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('login', () => {
  it('stores the token and sets the user on success', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    api.post.mockResolvedValue({ data: { token: 'new-token', user: { id: 'u2' } } });
    await act(async () => {
      await result.current.login({ email: 'a@test.dev', password: 'pw' });
    });

    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'a@test.dev', password: 'pw' });
    expect(localStorage.getItem('token')).toBe('new-token');
    expect(result.current.user).toEqual({ id: 'u2' });
  });

  it('leaves the token and user untouched when the request fails', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    api.post.mockRejectedValue(new Error('Invalid credentials'));
    await act(async () => {
      await expect(result.current.login({ email: 'a@test.dev', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials'
      );
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(result.current.user).toBeNull();
  });
});

describe('register', () => {
  it('stores the token and sets the user on success', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    api.post.mockResolvedValue({ data: { token: 'new-token', user: { id: 'u3' } } });
    await act(async () => {
      await result.current.register({ email: 'b@test.dev', password: 'pw' });
    });

    expect(api.post).toHaveBeenCalledWith('/auth/register', { email: 'b@test.dev', password: 'pw' });
    expect(result.current.user).toEqual({ id: 'u3' });
  });
});

describe('logout', () => {
  it('clears the token and the user', async () => {
    localStorage.setItem('token', 'valid-token');
    api.get.mockResolvedValue({ data: { id: 'u1' } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual({ id: 'u1' }));

    act(() => {
      result.current.logout();
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(localStorage.getItem('token')).toBeNull();
  });
});

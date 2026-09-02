import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockUseAuth = vi.fn();
vi.mock('../hooks/useAuth', () => ({ default: () => mockUseAuth() }));

const { default: ProtectedRoute } = await import('./ProtectedRoute.jsx');

const renderAt = (path = '/secret') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <div>secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProtectedRoute', () => {
  it('renders nothing while auth is still loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true });
    const { container } = renderAt();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });
    renderAt();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders the children when a user is present', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1' }, isLoading: false });
    renderAt();
    expect(screen.getByText('secret content')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// useAuth supplies login/register; the page's own job is form state,
// the passwords-match guard, error display, the loading flag and the
// post-success navigate. Mock the hook and useNavigate so those are the
// only things under test here.
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../hooks/useAuth', () => ({ default: () => ({ login: mockLogin }) }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const { default: LoginPage } = await import('./LoginPage.jsx');

const renderPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

const fillAndSubmit = (email = 'user@test.dev', password = 'secret') => {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } });
  return act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders the sign-in form and a link to register', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/register');
  });

  it('submits the entered credentials and navigates to the dashboard on success', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderPage();

    await fillAndSubmit('a@b.dev', 'pw123');

    expect(mockLogin).toHaveBeenCalledWith({ email: 'a@b.dev', password: 'pw123' });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the error message and does not navigate when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    renderPage();

    await fillAndSubmit();

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables the button and shows a pending label while the request is in flight', async () => {
    let resolveLogin;
    mockLogin.mockReturnValue(new Promise((resolve) => (resolveLogin = resolve)));
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.dev' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pw' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));

    const button = screen.getByRole('button', { name: 'Signing in...' });
    expect(button).toBeDisabled();

    await act(async () => resolveLogin());
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('clears a previous error when the form is resubmitted', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials')).mockResolvedValueOnce(undefined);
    renderPage();

    await fillAndSubmit();
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();

    await fillAndSubmit();
    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

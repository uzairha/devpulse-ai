import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../hooks/useAuth', () => ({ default: () => ({ register: mockRegister }) }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const { default: RegisterPage } = await import('./RegisterPage.jsx');

const renderPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );

const fill = ({ email = 'user@test.dev', password = 'password1', confirm = 'password1' } = {}) => {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: password } });
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: confirm } });
};

const submit = () =>
  act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'));
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RegisterPage', () => {
  it('renders the create-account form and a link to sign in', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min. 8 characters')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('registers with email and password only (dropping confirmPassword) and navigates on success', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderPage();

    fill({ email: 'a@b.dev', password: 'longenough', confirm: 'longenough' });
    await submit();

    expect(mockRegister).toHaveBeenCalledWith({ email: 'a@b.dev', password: 'longenough' });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('blocks submission and shows an error when the passwords do not match', async () => {
    renderPage();

    fill({ password: 'password1', confirm: 'password2' });
    await submit();

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('recovers after a mismatch: a corrected resubmit registers and navigates', async () => {
    mockRegister.mockResolvedValue(undefined);
    renderPage();

    fill({ password: 'password1', confirm: 'nope' });
    await submit();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();

    fill({ email: 'a@b.dev', password: 'password1', confirm: 'password1' });
    await submit();

    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
    expect(mockRegister).toHaveBeenCalledWith({ email: 'a@b.dev', password: 'password1' });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the server error message and does not navigate when register rejects', async () => {
    mockRegister.mockRejectedValue(new Error('Email already registered'));
    renderPage();

    fill();
    await submit();

    expect(screen.getByText('Email already registered')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables the button and shows a pending label while the request is in flight', async () => {
    let resolveRegister;
    mockRegister.mockReturnValue(new Promise((resolve) => (resolveRegister = resolve)));
    renderPage();

    fill();
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'));

    const button = screen.getByRole('button', { name: 'Creating account...' });
    expect(button).toBeDisabled();

    await act(async () => resolveRegister());
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });
});

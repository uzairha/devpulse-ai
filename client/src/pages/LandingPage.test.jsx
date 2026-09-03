import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from './LandingPage.jsx';

describe('LandingPage', () => {
  it('renders the product name and a Get Started link to /login', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { name: 'DevPulse AI' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/login');
  });
});

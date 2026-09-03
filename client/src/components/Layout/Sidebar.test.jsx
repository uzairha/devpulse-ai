import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>
  );

describe('Sidebar', () => {
  it('renders every nav item with its route', () => {
    renderAt('/dashboard');
    const expected = {
      Dashboard: '/dashboard',
      Repositories: '/repos',
      Compare: '/compare',
      Reports: '/reports',
      Settings: '/settings',
    };
    for (const [label, href] of Object.entries(expected)) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('href', href);
    }
  });

  it('marks the link for the current route active', () => {
    renderAt('/reports');
    expect(screen.getByRole('link', { name: /Reports/ })).toHaveClass('active');
    expect(screen.getByRole('link', { name: /Dashboard/ })).not.toHaveClass('active');
  });
});

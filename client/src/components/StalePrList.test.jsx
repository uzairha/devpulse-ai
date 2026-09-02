import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StalePrList } from './StalePrList.jsx';

const rows = [
  { number: 7, title: 'Old refactor', authorLogin: 'alice', ageDays: 40 },
  { number: 9, title: 'Stale docs', authorLogin: 'bob', ageDays: 21 },
];

describe('StalePrList', () => {
  it('renders nothing when there are no stale PRs', () => {
    expect(render(<StalePrList data={[]} repoFullName="o/r" />).container).toBeEmptyDOMElement();
    expect(render(<StalePrList data={null} repoFullName="o/r" />).container).toBeEmptyDOMElement();
  });

  it('renders a row per PR with its number, title, author and age', () => {
    render(<StalePrList data={rows} repoFullName="octo/app" />);
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('Old refactor')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('40d open')).toBeInTheDocument();
  });

  it('links each row to the PR on GitHub, opening in a new tab', () => {
    render(<StalePrList data={rows} repoFullName="octo/app" />);
    const link = screen.getByText('Old refactor').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/octo/app/pull/7');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContributorLeaderboard } from './ContributorLeaderboard.jsx';

const rows = [
  { login: 'alice', prCount: 12, commitCount: 40, additions: 900, deletions: 120 },
  { login: 'bob', prCount: 8, commitCount: 25, additions: 400, deletions: 60 },
  { login: 'carol', prCount: 5, commitCount: 15, additions: 200, deletions: 30 },
  { login: 'dave', prCount: 2, commitCount: 5, additions: 50, deletions: 10 },
];

const renderBoard = (data) =>
  render(
    <MemoryRouter>
      <ContributorLeaderboard data={data} repoId="r1" />
    </MemoryRouter>
  );

describe('ContributorLeaderboard', () => {
  it('renders nothing when there is no data', () => {
    expect(renderBoard([]).container).toBeEmptyDOMElement();
    expect(renderBoard(null).container).toBeEmptyDOMElement();
  });

  it('numbers each contributor by rank', () => {
    const { container } = renderBoard(rows);
    const ranks = [...container.querySelectorAll('.leaderboard-rank')].map((el) => el.textContent);
    expect(ranks).toEqual(['1', '2', '3', '4']);
  });

  it('shows each contributor with PR/commit counts and links to their detail page', () => {
    renderBoard(rows);
    expect(screen.getByText('12 PRs')).toBeInTheDocument();
    expect(screen.getByText('40 commits')).toBeInTheDocument();
    expect(screen.getByText('alice').closest('a')).toHaveAttribute(
      'href',
      '/repos/r1/contributors/alice'
    );
  });
});

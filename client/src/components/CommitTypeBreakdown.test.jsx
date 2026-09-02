import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommitTypeBreakdown } from './CommitTypeBreakdown.jsx';

const rows = [
  { type: 'feat', count: 8 },
  { type: 'fix', count: 4 },
  { type: 'other', count: 2 },
];

describe('CommitTypeBreakdown', () => {
  it('renders nothing when data is missing or empty', () => {
    expect(render(<CommitTypeBreakdown data={null} />).container).toBeEmptyDOMElement();
    expect(render(<CommitTypeBreakdown data={[]} />).container).toBeEmptyDOMElement();
  });

  it('renders a row per commit type with its count', () => {
    render(<CommitTypeBreakdown data={rows} />);
    expect(screen.getByText('feat')).toBeInTheDocument();
    expect(screen.getByText('fix')).toBeInTheDocument();
    expect(screen.getByText('other')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('scales bar width against the largest type', () => {
    const { container } = render(<CommitTypeBreakdown data={rows} />);
    const bars = container.querySelectorAll('.size-breakdown-bar');
    expect(bars[0].style.width).toBe('100%'); // feat = 8, the max
    expect(bars[1].style.width).toBe('50%'); // fix = 4 of 8
  });
});

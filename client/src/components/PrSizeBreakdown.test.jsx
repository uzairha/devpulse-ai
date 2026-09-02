import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrSizeBreakdown } from './PrSizeBreakdown.jsx';

const rows = [
  { label: 'XS', count: 2 },
  { label: 'S', count: 10 },
  { label: 'M', count: 5 },
  { label: 'L', count: 0 },
  { label: 'XL', count: 0 },
];

describe('PrSizeBreakdown', () => {
  it('renders nothing when data is missing', () => {
    const { container } = render(<PrSizeBreakdown data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every bucket is zero', () => {
    const { container } = render(
      <PrSizeBreakdown data={[{ label: 'XS', count: 0 }, { label: 'S', count: 0 }]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a labelled row with a count for each bucket', () => {
    render(<PrSizeBreakdown data={rows} />);
    expect(screen.getByText('XS')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('scales bar width to the largest bucket (the max bucket is 100%)', () => {
    const { container } = render(<PrSizeBreakdown data={rows} />);
    const bars = container.querySelectorAll('.size-breakdown-bar');
    expect(bars[1].style.width).toBe('100%'); // S = 10, the max
    expect(bars[0].style.width).toBe('20%'); // XS = 2 of 10
  });
});

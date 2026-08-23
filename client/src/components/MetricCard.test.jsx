import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard, TrendBadge } from './MetricCard.jsx';

describe('TrendBadge', () => {
  it('renders nothing when deltaPct is null', () => {
    const { container } = render(<TrendBadge deltaPct={null} invert={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an up arrow and "up" styling for a positive delta on a normal metric', () => {
    render(<TrendBadge deltaPct={12} invert={false} />);
    const badge = screen.getByText('▲ 12%');
    expect(badge).toHaveClass('metric-trend--up');
  });

  it('shows a down arrow and "down" styling for a negative delta on a normal metric', () => {
    render(<TrendBadge deltaPct={-8} invert={false} />);
    const badge = screen.getByText('▼ 8%');
    expect(badge).toHaveClass('metric-trend--down');
  });

  it('inverts polarity so a positive delta reads as "down" (bad) when invert is set', () => {
    render(<TrendBadge deltaPct={8} invert={true} />);
    expect(screen.getByText('▲ 8%')).toHaveClass('metric-trend--down');
  });

  it('inverts polarity so a negative delta reads as "up" (good) when invert is set', () => {
    render(<TrendBadge deltaPct={-8} invert={true} />);
    expect(screen.getByText('▼ 8%')).toHaveClass('metric-trend--up');
  });

  it('shows a flat arrow for a zero delta', () => {
    render(<TrendBadge deltaPct={0} invert={false} />);
    expect(screen.getByText('→ 0%')).toHaveClass('metric-trend--flat');
  });
});

describe('MetricCard', () => {
  it('renders the label and value', () => {
    render(<MetricCard label="Open PRs" value={7} />);
    expect(screen.getByText('Open PRs')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders an em dash when value is nullish', () => {
    render(<MetricCard label="Open PRs" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the sub line only when provided', () => {
    const { rerender } = render(<MetricCard label="X" value={1} sub="last 30 days" />);
    expect(screen.getByText('last 30 days')).toBeInTheDocument();

    rerender(<MetricCard label="X" value={1} />);
    expect(screen.queryByText('last 30 days')).not.toBeInTheDocument();
  });

  it('renders a trend badge only when a trend is provided', () => {
    const { container, rerender } = render(<MetricCard label="X" value={1} />);
    expect(container.querySelector('.metric-trend')).not.toBeInTheDocument();

    rerender(<MetricCard label="X" value={1} trend={{ deltaPct: 5 }} />);
    expect(container.querySelector('.metric-trend')).toBeInTheDocument();
  });
});

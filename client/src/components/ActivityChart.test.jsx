import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ActivityChart, ThroughputChart } from './ActivityChart.jsx';

describe('ActivityChart', () => {
  it('renders nothing without data', () => {
    expect(render(<ActivityChart data={null} />).container).toBeEmptyDOMElement();
    expect(render(<ActivityChart data={[]} />).container).toBeEmptyDOMElement();
  });

  it('draws one bar per day, capped at the last 30, scaled to the busiest day', () => {
    const data = Array.from({ length: 40 }, (_, i) => ({
      date: `2026-02-${String(i + 1).padStart(2, '0')}`,
      count: i === 39 ? 10 : 5,
    }));
    const { container } = render(<ActivityChart data={data} />);
    const bars = container.querySelectorAll('.chart-bar');
    expect(bars).toHaveLength(30);
    expect(bars[bars.length - 1].style.height).toBe('100%'); // busiest day
    expect(bars[0].style.height).toBe('50%'); // 5 of 10
  });

  it('labels the axis with the first and last visible day (month-day)', () => {
    const data = [
      { date: '2026-02-01', count: 1 },
      { date: '2026-02-05', count: 3 },
    ];
    const { container } = render(<ActivityChart data={data} />);
    const axis = container.querySelector('.chart-axis');
    expect(axis).toHaveTextContent('02-01');
    expect(axis).toHaveTextContent('02-05');
  });
});

describe('ThroughputChart', () => {
  it('renders nothing without data', () => {
    expect(render(<ThroughputChart data={null} />).container).toBeEmptyDOMElement();
    expect(render(<ThroughputChart data={[]} />).container).toBeEmptyDOMElement();
  });

  it('draws a polyline with one dot per week', () => {
    const data = [
      { weekStart: '2026-01-05', count: 2 },
      { weekStart: '2026-01-12', count: 6 },
      { weekStart: '2026-01-19', count: 4 },
    ];
    const { container } = render(<ThroughputChart data={data} />);
    expect(container.querySelector('path.chart-line-path')).toBeInTheDocument();
    expect(container.querySelectorAll('circle.chart-line-dot')).toHaveLength(3);
  });
});

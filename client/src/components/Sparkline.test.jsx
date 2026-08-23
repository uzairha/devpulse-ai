import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline, timeAgo } from './Sparkline.jsx';

describe('timeAgo', () => {
  it('returns the no-activity message for a null date', () => {
    expect(timeAgo(null)).toBe('No recent activity');
  });

  it('returns "Active today" for the current moment', () => {
    expect(timeAgo(new Date().toISOString())).toBe('Active today');
  });

  it('returns "Active yesterday" for exactly one day ago', () => {
    const oneDayAgo = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    expect(timeAgo(oneDayAgo)).toBe('Active yesterday');
  });

  it('returns a day count under two weeks', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString();
    expect(timeAgo(fiveDaysAgo)).toBe('Active 5d ago');
  });

  it('returns a week count at two weeks or more', () => {
    const threeWeeksAgo = new Date(Date.now() - 21 * 86400000).toISOString();
    expect(timeAgo(threeWeeksAgo)).toBe('Active 3w ago');
  });
});

describe('Sparkline', () => {
  it('renders nothing for empty data', () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for missing data', () => {
    const { container } = render(<Sparkline data={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an svg path spanning every data point', () => {
    const data = [{ count: 1 }, { count: 5 }, { count: 2 }];
    const { container } = render(<Sparkline data={data} />);
    const path = container.querySelector('path.sparkline-path');
    expect(path).toBeInTheDocument();
    expect(path.getAttribute('d')).toMatch(/^M0,\S+ L60,\S+ L120,\S+$/);
  });

  it('sets an accessible label describing the day count', () => {
    const data = [{ count: 1 }, { count: 2 }];
    const { getByRole } = render(<Sparkline data={data} />);
    expect(getByRole('img')).toHaveAccessibleName('Activity over the last 2 days');
  });
});

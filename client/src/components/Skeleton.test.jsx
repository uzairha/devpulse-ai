import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, MetricsGridSkeleton } from './Skeleton.jsx';

describe('Skeleton', () => {
  it('applies default sizing', () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector('.skeleton');
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('1rem');
    expect(el.style.borderRadius).toBe('6px');
  });

  it('applies custom sizing and an extra class name', () => {
    const { container } = render(<Skeleton width="50%" height="2rem" className="mine" />);
    const el = container.querySelector('.skeleton');
    expect(el).toHaveClass('mine');
    expect(el.style.width).toBe('50%');
    expect(el.style.height).toBe('2rem');
  });
});

describe('MetricsGridSkeleton', () => {
  it('renders six placeholder cards by default', () => {
    const { container } = render(<MetricsGridSkeleton />);
    expect(container.querySelectorAll('.metric-card')).toHaveLength(6);
  });

  it('honours an explicit count', () => {
    const { container } = render(<MetricsGridSkeleton count={3} />);
    expect(container.querySelectorAll('.metric-card')).toHaveLength(3);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker, buildRangeQuery, DEFAULT_RANGE } from './DateRangePicker.jsx';

describe('buildRangeQuery', () => {
  it('builds a days= query for the default preset range', () => {
    expect(buildRangeQuery(DEFAULT_RANGE)).toBe('days=30');
  });

  it('builds a startDate/endDate query when both are set', () => {
    const query = buildRangeQuery({ days: 30, startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(query).toBe('startDate=2026-01-01&endDate=2026-01-31');
  });

  it('falls back to days= when only one custom date is set', () => {
    expect(buildRangeQuery({ days: 7, startDate: '2026-01-01', endDate: null })).toBe('days=7');
  });
});

describe('DateRangePicker', () => {
  const preset = { days: 30, startDate: null, endDate: null };

  it('marks the active preset tab and reports a new preset on click', () => {
    const onChange = vi.fn();
    render(<DateRangePicker range={preset} onChange={onChange} />);

    expect(screen.getByRole('button', { name: '30d' })).toHaveClass('active');

    fireEvent.click(screen.getByRole('button', { name: '7d' }));
    expect(onChange).toHaveBeenCalledWith({ days: 7, startDate: null, endDate: null });
  });

  it('reveals two date inputs when Custom is clicked', () => {
    render(<DateRangePicker range={preset} onChange={vi.fn()} />);
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(2);
  });

  it('only commits a custom range once both dates are set and start <= end', () => {
    const onChange = vi.fn();
    render(<DateRangePicker range={preset} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const [start, end] = document.querySelectorAll('input[type="date"]');

    fireEvent.change(start, { target: { value: '2026-03-01' } });
    expect(onChange).not.toHaveBeenCalled(); // end still empty

    fireEvent.change(end, { target: { value: '2026-02-01' } });
    expect(onChange).not.toHaveBeenCalled(); // start > end

    fireEvent.change(end, { target: { value: '2026-03-31' } });
    expect(onChange).toHaveBeenCalledWith({
      days: null,
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
  });

  it('starts in custom mode when the incoming range already has both dates', () => {
    render(
      <DateRangePicker
        range={{ days: null, startDate: '2026-01-01', endDate: '2026-01-31' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveClass('active');
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(2);
  });
});

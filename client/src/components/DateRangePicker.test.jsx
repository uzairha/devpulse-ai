import { describe, it, expect } from 'vitest';
import { buildRangeQuery, DEFAULT_RANGE } from './DateRangePicker.jsx';

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

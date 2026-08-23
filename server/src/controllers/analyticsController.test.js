import { describe, it, expect } from 'vitest';
import { resolveRange } from './analyticsController.js';

describe('resolveRange', () => {
  it('defaults to a 30-day preset window when no query params are given', () => {
    const { since, until } = resolveRange({});
    const days = Math.round((until - since) / 86400000);
    expect(days).toBe(30);
  });

  it('honors an explicit ?days= preset', () => {
    const { since, until } = resolveRange({ days: '7' });
    const days = Math.round((until - since) / 86400000);
    expect(days).toBe(7);
  });

  it('clamps a preset above MAX_RANGE_DAYS to 365', () => {
    const { since, until } = resolveRange({ days: '9999' });
    const days = Math.round((until - since) / 86400000);
    expect(days).toBe(365);
  });

  it('resolves an explicit custom start/end date range', () => {
    const range = resolveRange({ startDate: '2026-01-01', endDate: '2026-01-10' });
    expect(range.since.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(range.until.toISOString().slice(0, 10)).toBe('2026-01-10');
  });

  it('returns null when startDate is after endDate', () => {
    expect(resolveRange({ startDate: '2026-01-10', endDate: '2026-01-01' })).toBeNull();
  });

  it('returns null for an unparseable custom date', () => {
    expect(resolveRange({ startDate: 'not-a-date', endDate: '2026-01-10' })).toBeNull();
  });

  it('clamps a custom range spanning more than MAX_RANGE_DAYS to 365 days', () => {
    const range = resolveRange({ startDate: '2020-01-01', endDate: '2026-01-10' });
    const days = Math.round((range.until - range.since) / 86400000);
    expect(days).toBe(365);
  });

  it('clamps until to now when endDate is in the future', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const range = resolveRange({ startDate: '2026-01-01', endDate: future });
    expect(range.until.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});

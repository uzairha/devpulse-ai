import { describe, it, expect } from 'vitest';
import {
  CONVENTIONAL_COMMIT_RE,
  buildCommitTypeBreakdown,
  buildPrSizeBreakdown,
  buildDailyBuckets,
  buildHeatmapCells,
  buildWeeklyBuckets,
} from './analyticsService.js';

describe('CONVENTIONAL_COMMIT_RE', () => {
  it('matches a plain conventional type', () => {
    expect('feat: add X'.match(CONVENTIONAL_COMMIT_RE)?.[1]).toBe('feat');
  });

  it('matches a scoped type', () => {
    expect('fix(api): correct Y'.match(CONVENTIONAL_COMMIT_RE)?.[1]).toBe('fix');
  });

  it('matches a breaking-change marker', () => {
    expect('refactor!: rework Z'.match(CONVENTIONAL_COMMIT_RE)?.[1]).toBe('refactor');
  });

  it('does not match a non-conventional message', () => {
    expect('Updated stuff'.match(CONVENTIONAL_COMMIT_RE)).toBeNull();
  });

  it('does not match without the trailing space after the colon', () => {
    expect('feat:add X'.match(CONVENTIONAL_COMMIT_RE)).toBeNull();
  });
});

describe('buildCommitTypeBreakdown', () => {
  it('counts each type and buckets null as other', () => {
    const result = buildCommitTypeBreakdown(['feat', 'fix', 'feat', null, null, null]);
    expect(result).toEqual([
      { type: 'other', count: 3 },
      { type: 'feat', count: 2 },
      { type: 'fix', count: 1 },
    ]);
  });

  it('returns an empty array for no commits', () => {
    expect(buildCommitTypeBreakdown([])).toEqual([]);
  });
});

describe('buildPrSizeBreakdown', () => {
  it('buckets PRs by additions+deletions into size labels', () => {
    const prs = [
      { additions: 2, deletions: 1 }, // 3 -> XS
      { additions: 30, deletions: 10 }, // 40 -> S
      { additions: 100, deletions: 50 }, // 150 -> M
      { additions: 300, deletions: 100 }, // 400 -> L
      { additions: 1000, deletions: 0 }, // 1000 -> XL
    ];
    expect(buildPrSizeBreakdown(prs)).toEqual([
      { label: 'XS', count: 1 },
      { label: 'S', count: 1 },
      { label: 'M', count: 1 },
      { label: 'L', count: 1 },
      { label: 'XL', count: 1 },
    ]);
  });

  it('places an exact bucket boundary in the lower bucket', () => {
    const prs = [{ additions: 10, deletions: 0 }]; // exactly 10 -> XS (max: 10)
    const result = buildPrSizeBreakdown(prs);
    expect(result.find((b) => b.label === 'XS').count).toBe(1);
  });

  it('returns zero counts for every bucket when given no PRs', () => {
    expect(buildPrSizeBreakdown([])).toEqual([
      { label: 'XS', count: 0 },
      { label: 'S', count: 0 },
      { label: 'M', count: 0 },
      { label: 'L', count: 0 },
      { label: 'XL', count: 0 },
    ]);
  });
});

describe('buildDailyBuckets', () => {
  it('fills every day in range with zero, then counts matching dates', () => {
    const since = new Date('2026-01-01T00:00:00.000Z');
    const until = new Date('2026-01-03T00:00:00.000Z');
    const dates = ['2026-01-01T10:00:00.000Z', '2026-01-01T15:00:00.000Z', '2026-01-03T00:00:00.000Z'];
    expect(buildDailyBuckets(dates, since, until)).toEqual([
      { date: '2026-01-01', count: 2 },
      { date: '2026-01-02', count: 0 },
      { date: '2026-01-03', count: 1 },
    ]);
  });

  it('ignores dates outside the bucketed range', () => {
    const since = new Date('2026-01-01T00:00:00.000Z');
    const until = new Date('2026-01-01T00:00:00.000Z');
    const result = buildDailyBuckets(['2026-02-01T00:00:00.000Z'], since, until);
    expect(result).toEqual([{ date: '2026-01-01', count: 0 }]);
  });
});

describe('buildHeatmapCells', () => {
  it('returns 168 cells (7 days x 24 hours)', () => {
    expect(buildHeatmapCells([])).toHaveLength(168);
  });

  it('buckets a date into its UTC day-of-week and hour', () => {
    // 2026-01-04 is a Sunday (day 0); 14:30 UTC -> hour 14
    const cells = buildHeatmapCells(['2026-01-04T14:30:00.000Z']);
    const cell = cells.find((c) => c.day === 0 && c.hour === 14);
    expect(cell.count).toBe(1);
    expect(cells.filter((c) => c.count > 0)).toHaveLength(1);
  });
});

describe('buildWeeklyBuckets', () => {
  it('splits a two-week range into two weekly buckets', () => {
    const since = new Date('2026-01-01T00:00:00.000Z');
    const until = new Date('2026-01-15T00:00:00.000Z');
    const dates = ['2026-01-02T00:00:00.000Z', '2026-01-10T00:00:00.000Z'];
    const result = buildWeeklyBuckets(dates, since, until);
    expect(result).toEqual([
      { weekStart: '2026-01-01', count: 1 },
      { weekStart: '2026-01-08', count: 1 },
    ]);
  });
});

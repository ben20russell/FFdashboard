import { describe, expect, it } from 'vitest';

import { calculatePlayerValue } from '@/lib/model';

describe('calculatePlayerValue', () => {
  it('returns a numeric value score for a player object', () => {
    const score = calculatePlayerValue({
      name: 'Josh Allen',
      position: 'QB',
      projectedPoints: 24.5,
    });

    expect(typeof score).toBe('number');
    expect(Number.isFinite(score)).toBe(true);
  });

  it('gives higher projected points a higher value score (all else equal)', () => {
    const lower = calculatePlayerValue({
      name: 'Player One',
      position: 'RB',
      projectedPoints: 10,
    });
    const higher = calculatePlayerValue({
      name: 'Player One',
      position: 'RB',
      projectedPoints: 20,
    });

    expect(higher).toBeGreaterThan(lower);
  });

  it('applies position weighting so RB/WR are slightly boosted', () => {
    const qb = calculatePlayerValue({
      name: 'Same Name',
      position: 'QB',
      projectedPoints: 15,
    });
    const rb = calculatePlayerValue({
      name: 'Same Name',
      position: 'RB',
      projectedPoints: 15,
    });

    expect(rb).toBeGreaterThan(qb);
  });
});

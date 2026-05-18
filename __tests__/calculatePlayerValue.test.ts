import { describe, expect, it } from 'vitest';

import { calculatePlayerValue } from '@/lib/model';

describe('calculatePlayerValue', () => {
  it('returns median/floor/ceiling projections for a player object', () => {
    const projection = calculatePlayerValue({
      name: 'Josh Allen',
      position: 'QB',
      projectedPoints: 24.5,
    });

    expect(typeof projection).toBe('object');
    expect(projection).toHaveProperty('median');
    expect(projection).toHaveProperty('floor');
    expect(projection).toHaveProperty('ceiling');
    expect(projection.floor).toBeLessThan(projection.median);
    expect(projection.ceiling).toBeGreaterThan(projection.median);
  });

  it('gives higher projected points a higher median (all else equal)', () => {
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

    expect(higher.median).toBeGreaterThan(lower.median);
  });

  it('applies position-specific volatility bands', () => {
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

    const qbRange = qb.ceiling - qb.floor;
    const rbRange = rb.ceiling - rb.floor;
    expect(rbRange).toBeGreaterThan(qbRange);
  });
});

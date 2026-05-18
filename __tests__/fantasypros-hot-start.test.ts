import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as fantasyProsClient from '@/lib/fantasypros-client';
import { getFantasyProsPlayers as getMergedFantasyProsPlayers } from '@/lib/fantasypros';

vi.mock('@/lib/fantasypros-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/fantasypros-client')>('@/lib/fantasypros-client');
  return {
    ...actual,
    getFantasyProsPlayers: vi.fn(),
    getFantasyProsRankings: vi.fn(),
    getFantasyProsProjections: vi.fn(),
    getFantasyProsInjuries: vi.fn(),
  };
});

type CollectionResult = {
  items: Array<Record<string, unknown>>;
  rawPayload: Record<string, unknown>;
  fetchedAtIso: string;
  errorMessage: string | null;
  endpoint: string;
};

function createCollectionResult(items: Array<Record<string, unknown>>, endpoint: string): CollectionResult {
  return {
    items,
    rawPayload: { items },
    fetchedAtIso: '2026-08-01T00:00:00.000Z',
    errorMessage: null,
    endpoint,
  };
}

describe('fantasypros hot-start aggregation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.FANTASYPROS_WEEK;
  });

  it('fetches projections for weeks 1-4 and merges total into earlySeasonPoints', async () => {
    const playersMock = vi.mocked(fantasyProsClient.getFantasyProsPlayers);
    const rankingsMock = vi.mocked(fantasyProsClient.getFantasyProsRankings);
    const projectionsMock = vi.mocked(fantasyProsClient.getFantasyProsProjections);
    const injuriesMock = vi.mocked(fantasyProsClient.getFantasyProsInjuries);

    playersMock.mockResolvedValue(
      createCollectionResult(
        [{ id: 9001, player_name: 'Hot Start WR', position_id: 'WR', team_id: 'MIA' }],
        'players',
      ) as Awaited<ReturnType<typeof fantasyProsClient.getFantasyProsPlayers>>,
    );
    rankingsMock.mockResolvedValue(
      createCollectionResult([{ id: 9001, rank_ecr: '25' }], 'rankings') as Awaited<
        ReturnType<typeof fantasyProsClient.getFantasyProsRankings>
      >,
    );
    injuriesMock.mockResolvedValue(
      createCollectionResult([], 'injuries') as Awaited<ReturnType<typeof fantasyProsClient.getFantasyProsInjuries>>,
    );

    projectionsMock.mockImplementation((query) => {
      const week = Number((query as Record<string, unknown> | undefined)?.week ?? 0);
      const weekPoints: Record<number, string> = {
        1: '10.5',
        2: '12',
        3: '13.5',
        4: '14',
      };

      if (week >= 1 && week <= 4) {
        return Promise.resolve(
          createCollectionResult(
            [{ id: 9001, player_name: 'Hot Start WR', position_id: 'WR', projected_points: weekPoints[week] }],
            `projections-week-${week}`,
          ) as Awaited<ReturnType<typeof fantasyProsClient.getFantasyProsProjections>>,
        );
      }

      return Promise.resolve(
        createCollectionResult(
          [{ id: 9001, player_name: 'Hot Start WR', position_id: 'WR', projected_points: '210' }],
          'projections-season',
        ) as Awaited<ReturnType<typeof fantasyProsClient.getFantasyProsProjections>>,
      );
    });

    const result = await getMergedFantasyProsPlayers();
    const projectionWeeksQueried = projectionsMock.mock.calls
      .map((call) => Number(((call[0] ?? {}) as Record<string, unknown>).week))
      .filter((week) => Number.isFinite(week) && week > 0)
      .sort((a, b) => a - b);

    expect(projectionsMock).toHaveBeenCalledTimes(5);
    expect(projectionWeeksQueried).toEqual([1, 2, 3, 4]);
    expect(result.players[0]?.earlySeasonPoints).toBe(50);
    expect(result.players[0]?.week1Points).toBe(10.5);
    expect(result.players[0]?.week2Points).toBe(12);
    expect(result.players[0]?.week3Points).toBe(13.5);
    expect(result.players[0]?.week4Points).toBe(14);
  });
});

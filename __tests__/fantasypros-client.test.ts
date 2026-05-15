import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildFantasyProsEndpoint,
  buildFantasyProsNflProjectionEndpoint,
  buildFantasyProsSeasonEndpoint,
  extractCollectionFromPayload,
  fetchFantasyProsCollection,
  getFantasyProsInjuries,
  getFantasyProsPlayers,
  getFantasyProsProjections,
  getFantasyProsRankings,
} from '@/lib/fantasypros-client';

describe('fantasypros-client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FANTASYPROS_API_KEY;
    delete process.env.FANTASYPROS_SPORT;
    delete process.env.FANTASYPROS_SEASON;
  });

  it('builds endpoint paths for public v2 json API', () => {
    const endpoint = buildFantasyProsEndpoint({ sport: 'NFL', resource: 'players' });
    expect(endpoint).toBe('https://api.fantasypros.com/public/v2/json/NFL/players');
  });

  it('builds endpoint paths with query params', () => {
    const endpoint = buildFantasyProsEndpoint({
      sport: 'NFL',
      resource: 'rankings',
      query: {
        week: 1,
        scoring: 'PPR',
      },
    });

    expect(endpoint).toContain('/NFL/rankings?');
    expect(endpoint).toContain('week=1');
    expect(endpoint).toContain('scoring=PPR');
  });

  it('builds season-based ranking and projection endpoints', () => {
    const rankingsEndpoint = buildFantasyProsSeasonEndpoint({
      sport: 'NFL',
      season: 2025,
      resource: 'rankings',
      query: { week: 1 },
    });
    const projectionsEndpoint = buildFantasyProsNflProjectionEndpoint({
      season: 2025,
      query: { week: 1 },
    });

    expect(rankingsEndpoint).toBe('https://api.fantasypros.com/public/v2/json/NFL/2025/rankings?week=1');
    expect(projectionsEndpoint).toBe('https://api.fantasypros.com/public/v2/json/nfl/2025/projections?week=1');
  });

  it('extracts preferred collection key from payload', () => {
    const payload = {
      rankings: [{ id: 'a' }],
      data: [{ id: 'b' }],
    };

    const rankings = extractCollectionFromPayload(payload, 'rankings');
    expect(rankings).toEqual([{ id: 'a' }]);
  });

  it('falls back to data collection if preferred key is absent', () => {
    const payload = {
      data: [{ id: 'fallback' }],
    };

    const projections = extractCollectionFromPayload(payload, 'projections');
    expect(projections).toEqual([{ id: 'fallback' }]);
  });

  it('returns an error when API key is missing', async () => {
    const result = await fetchFantasyProsCollection({
      resource: 'players',
      preferredKey: 'players',
    });

    expect(result.errorMessage).toMatch(/Missing FANTASYPROS_API_KEY/);
    expect(result.items).toEqual([]);
  });

  it('uses wrappers and parses collection results', async () => {
    process.env.FANTASYPROS_API_KEY = 'test-key';
    process.env.FANTASYPROS_SPORT = 'NFL';

    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        players: [{ id: 1, name: 'Player One' }],
      }),
    } as Response);

    const result = await getFantasyProsPlayers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.errorMessage).toBeNull();
    expect(result.items).toEqual([{ id: 1, name: 'Player One' }]);
  });

  it('supports rankings/projections/injuries wrappers', async () => {
    process.env.FANTASYPROS_API_KEY = 'test-key';
    process.env.FANTASYPROS_SEASON = '2025';

    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ rankings: [{ id: 'r1' }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ projections: [{ id: 'p1' }] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ injuries: [{ id: 'i1' }] }),
      } as Response);

    const [rankings, projections, injuries] = await Promise.all([
      getFantasyProsRankings({ week: 1 }),
      getFantasyProsProjections({ week: 1 }),
      getFantasyProsInjuries(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.fantasypros.com/public/v2/json/NFL/2025/rankings?week=1');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://api.fantasypros.com/public/v2/json/nfl/2025/projections?week=1');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://api.fantasypros.com/public/v2/json/NFL/injuries');
    expect(rankings.items).toEqual([{ id: 'r1' }]);
    expect(projections.items).toEqual([{ id: 'p1' }]);
    expect(injuries.items).toEqual([{ id: 'i1' }]);
  });
});

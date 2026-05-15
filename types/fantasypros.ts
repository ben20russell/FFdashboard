export type FantasyProsSport = 'NFL' | 'MLB' | 'NBA' | 'NHL' | (string & {});

export type FantasyProsCollectionKey = 'players' | 'rankings' | 'projections' | 'injuries' | 'data';

export type FantasyProsRecord = Record<string, unknown>;

export type FantasyProsQueryValue = string | number | boolean | null | undefined;

export type FantasyProsQueryParams = Record<string, FantasyProsQueryValue>;

export type FantasyProsFetchResult<TItem extends FantasyProsRecord> = {
  items: TItem[];
  rawPayload: unknown;
  fetchedAtIso: string;
  errorMessage: string | null;
  endpoint: string;
};

export type FantasyProsRankingRecord = FantasyProsRecord & {
  rank?: number | string;
  player_name?: string;
  name?: string;
  position?: string;
};

export type FantasyProsProjectionRecord = FantasyProsRecord & {
  projected_points?: number | string;
  points?: number | string;
  player_name?: string;
  name?: string;
  position?: string;
};

export type FantasyProsInjuryRecord = FantasyProsRecord & {
  player_name?: string;
  name?: string;
  position?: string;
  injury_status?: string;
  status?: string;
};

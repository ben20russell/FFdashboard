import type { PlayerInput } from '@/types/player';
import type {
  FantasyProsCollectionKey,
  FantasyProsFetchResult,
  FantasyProsInjuryRecord,
  FantasyProsProjectionRecord,
  FantasyProsQueryParams,
  FantasyProsRankingRecord,
  FantasyProsRecord,
  FantasyProsSport,
} from '@/types/fantasypros';

const FANTASYPROS_API_BASE_URL = 'https://api.fantasypros.com/public/v2/json';
const DEFAULT_SPORT: FantasyProsSport = 'NFL';
const DEFAULT_REVALIDATE_SECONDS = 3600;

type FetchCollectionOptions = {
  sport?: FantasyProsSport;
  resource: Exclude<FantasyProsCollectionKey, 'data'>;
  preferredKey: FantasyProsCollectionKey;
  query?: FantasyProsQueryParams;
};

type BuildEndpointOptions = {
  sport: FantasyProsSport;
  resource: Exclude<FantasyProsCollectionKey, 'data'>;
  query?: FantasyProsQueryParams;
};

type BuildSeasonEndpointOptions = {
  sport: FantasyProsSport;
  season: number;
  resource: 'rankings' | 'consensus-rankings';
  query?: FantasyProsQueryParams;
};

type BuildNflProjectionEndpointOptions = {
  season: number;
  query?: FantasyProsQueryParams;
};

export function buildFantasyProsEndpoint({ sport, resource, query }: BuildEndpointOptions): string {
  const basePath = `${FANTASYPROS_API_BASE_URL}/${sport.toUpperCase()}/${resource}`;

  if (!query) {
    return basePath;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function withQueryString(basePath: string, query?: FantasyProsQueryParams): string {
  if (!query) {
    return basePath;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function buildFantasyProsSeasonEndpoint({ sport, season, resource, query }: BuildSeasonEndpointOptions): string {
  const basePath = `${FANTASYPROS_API_BASE_URL}/${sport.toUpperCase()}/${season}/${resource}`;
  return withQueryString(basePath, query);
}

export function buildFantasyProsNflProjectionEndpoint({ season, query }: BuildNflProjectionEndpointOptions): string {
  const basePath = `${FANTASYPROS_API_BASE_URL}/nfl/${season}/projections`;
  return withQueryString(basePath, query);
}

function getConfiguredSport(inputSport?: FantasyProsSport): FantasyProsSport {
  if (inputSport) {
    return inputSport.toUpperCase() as FantasyProsSport;
  }

  const envSport = process.env.FANTASYPROS_SPORT;
  if (envSport) {
    return envSport.toUpperCase() as FantasyProsSport;
  }

  return DEFAULT_SPORT;
}

function getConfiguredSeason(): number {
  const envSeason = process.env.FANTASYPROS_SEASON;

  if (!envSeason) {
    return new Date().getFullYear();
  }

  const parsedSeason = Number.parseInt(envSeason, 10);
  if (!Number.isFinite(parsedSeason) || parsedSeason < 2012) {
    console.warn('[getConfiguredSeason] Invalid FANTASYPROS_SEASON value, using current year', { envSeason });
    return new Date().getFullYear();
  }

  return parsedSeason;
}

export function extractCollectionFromPayload<TItem extends FantasyProsRecord>(
  payload: unknown,
  preferredKey: FantasyProsCollectionKey,
): TItem[] {
  if (Array.isArray(payload)) {
    return payload as TItem[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;

    if (Array.isArray(objectPayload[preferredKey])) {
      return objectPayload[preferredKey] as TItem[];
    }

    if (Array.isArray(objectPayload.players)) {
      return objectPayload.players as TItem[];
    }

    if (Array.isArray(objectPayload.rankings)) {
      return objectPayload.rankings as TItem[];
    }

    if (Array.isArray(objectPayload.projections)) {
      return objectPayload.projections as TItem[];
    }

    if (Array.isArray(objectPayload.injuries)) {
      return objectPayload.injuries as TItem[];
    }

    if (Array.isArray(objectPayload.data)) {
      return objectPayload.data as TItem[];
    }
  }

  return [];
}

export async function fetchFantasyProsCollection<TItem extends FantasyProsRecord>(
  options: FetchCollectionOptions,
): Promise<FantasyProsFetchResult<TItem>> {
  const sport = getConfiguredSport(options.sport);
  const endpoint = buildFantasyProsEndpoint({
    sport,
    resource: options.resource,
    query: options.query,
  });
  return fetchFantasyProsCollectionByEndpoint<TItem>(endpoint, options.preferredKey);
}

async function fetchFantasyProsCollectionByEndpoint<TItem extends FantasyProsRecord>(
  endpoint: string,
  preferredKey: FantasyProsCollectionKey,
): Promise<FantasyProsFetchResult<TItem>> {
  const apiKey = process.env.FANTASYPROS_API_KEY;
  const fetchedAtIso = new Date().toISOString();

  console.log('[fetchFantasyProsCollection] Request start', {
    endpoint,
    preferredKey,
    hasApiKey: Boolean(apiKey),
    revalidateSeconds: DEFAULT_REVALIDATE_SECONDS,
  });

  if (!apiKey) {
    const message = 'Missing FANTASYPROS_API_KEY in environment variables.';
    console.error('[fetchFantasyProsCollection] Missing configuration', { message });

    return {
      items: [],
      rawPayload: { error: message },
      fetchedAtIso,
      errorMessage: message,
      endpoint,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      next: {
        revalidate: DEFAULT_REVALIDATE_SECONDS,
      },
    });

    console.log('[fetchFantasyProsCollection] Response metadata', {
      endpoint,
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const responseText = await response.text();
      const message = `FantasyPros request failed with status ${response.status}.`;

      console.error('[fetchFantasyProsCollection] Non-OK response', {
        endpoint,
        responseText,
      });

      return {
        items: [],
        rawPayload: {
          error: message,
          details: responseText,
        },
        fetchedAtIso,
        errorMessage: message,
        endpoint,
      };
    }

    const rawPayload = (await response.json()) as unknown;
    const items = extractCollectionFromPayload<TItem>(rawPayload, preferredKey);

    console.log('[fetchFantasyProsCollection] Parsed collection', {
      endpoint,
      preferredKey,
      itemCount: items.length,
    });

    return {
      items,
      rawPayload,
      fetchedAtIso,
      errorMessage: null,
      endpoint,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error occurred while fetching FantasyPros data.';

    console.error('[fetchFantasyProsCollection] Fetch exception', {
      endpoint,
      error,
    });

    return {
      items: [],
      rawPayload: { error: message },
      fetchedAtIso,
      errorMessage: message,
      endpoint,
    };
  }
}

export async function getFantasyProsPlayers(query?: FantasyProsQueryParams) {
  return fetchFantasyProsCollection<PlayerInput>({
    resource: 'players',
    preferredKey: 'players',
    query,
  });
}

export async function getFantasyProsRankings(query?: FantasyProsQueryParams) {
  const sport = getConfiguredSport();
  const configuredSeason = getConfiguredSeason();
  const seasonsToTry = [configuredSeason, configuredSeason - 1];

  for (const season of seasonsToTry) {
    const endpoint = buildFantasyProsSeasonEndpoint({
      sport,
      season,
      resource: 'rankings',
      query,
    });

    const result = await fetchFantasyProsCollectionByEndpoint<FantasyProsRankingRecord>(endpoint, 'players');
    if (result.items.length > 0 || !result.errorMessage) {
      return result;
    }
  }

  return fetchFantasyProsCollectionByEndpoint<FantasyProsRankingRecord>(
    buildFantasyProsSeasonEndpoint({
      sport,
      season: configuredSeason,
      resource: 'rankings',
      query,
    }),
    'players',
  );
}

export async function getFantasyProsProjections(query?: FantasyProsQueryParams) {
  const configuredSeason = getConfiguredSeason();
  const seasonsToTry = [configuredSeason, configuredSeason - 1];

  for (const season of seasonsToTry) {
    const endpoint = buildFantasyProsNflProjectionEndpoint({
      season,
      query,
    });

    const result = await fetchFantasyProsCollectionByEndpoint<FantasyProsProjectionRecord>(endpoint, 'players');
    if (result.items.length > 0 || !result.errorMessage) {
      return result;
    }
  }

  return fetchFantasyProsCollectionByEndpoint<FantasyProsProjectionRecord>(
    buildFantasyProsNflProjectionEndpoint({
      season: configuredSeason,
      query,
    }),
    'players',
  );
}

export async function getFantasyProsInjuries(query?: FantasyProsQueryParams) {
  return fetchFantasyProsCollection<FantasyProsInjuryRecord>({
    resource: 'injuries',
    preferredKey: 'injuries',
    query,
  });
}

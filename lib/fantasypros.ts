import {
  getFantasyProsInjuries,
  getFantasyProsPlayers as getFantasyProsPlayersFromApi,
  getFantasyProsProjections,
  getFantasyProsRankings,
} from '@/lib/fantasypros-client';
import { calculatePlayerValue } from '@/lib/model';
import type {
  FantasyProsInjuryRecord,
  FantasyProsProjectionRecord,
  FantasyProsQueryParams,
  FantasyProsRankingRecord,
  FantasyProsRecord,
} from '@/types/fantasypros';
import type { DashboardPlayer, PlayerInput } from '@/types/player';

function parseFloatSafe(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseProjectedPoints(player: Partial<PlayerInput>): number {
  const directPoints = parseFloatSafe(player.projected_points ?? player.projectedPoints ?? player.points);
  if (directPoints > 0) {
    return directPoints;
  }

  const stats = player.stats;
  if (Array.isArray(stats) && stats.length > 0) {
    const firstStat = stats[0];

    if (firstStat && typeof firstStat === 'object') {
      const statRecord = firstStat as Record<string, unknown>;
      const statPoints = parseFloatSafe(
        statRecord.points ??
          statRecord.points_ppr ??
          statRecord.points_half ??
          statRecord.fantasy_points ??
          statRecord.projected_points,
      );

      if (statPoints > 0) {
        return statPoints;
      }
    }
  }

  return directPoints;
}

function parseRank(input: unknown): number | null {
  if (input && typeof input === 'object') {
    const inputRecord = input as Record<string, unknown>;
    const nestedRank = parseFloatSafe(
      inputRecord.rank_ecr ??
        inputRecord.ecr ??
        (inputRecord.ECR && typeof inputRecord.ECR === 'object'
          ? (inputRecord.ECR as Record<string, unknown>).ALL
          : undefined),
    );

    if (nestedRank > 0) {
      return Math.round(nestedRank);
    }
  }

  const rank = parseFloatSafe(input);
  if (!Number.isFinite(rank) || rank <= 0) {
    return null;
  }

  return Math.round(rank);
}

function normalizeName(record: Partial<FantasyProsRecord>): string {
  const name =
    (typeof record.name === 'string' && record.name) ||
    (typeof record.player_name === 'string' && record.player_name) ||
    (typeof record.full_name === 'string' && record.full_name) ||
    '';

  return name.trim();
}

function normalizePosition(record: Partial<FantasyProsRecord>): string {
  const positionSource =
    (typeof record.position === 'string' && record.position) ||
    (typeof record.position_id === 'string' && record.position_id) ||
    (typeof record.pos === 'string' && record.pos) ||
    '';
  const position = positionSource.trim().toUpperCase();
  return position;
}

function createAliases(record: Partial<FantasyProsRecord>): string[] {
  const aliases: string[] = [];
  const idValue = record.id;
  if (typeof idValue === 'number' || typeof idValue === 'string') {
    aliases.push(`id:${String(idValue)}`);
  }

  const normalizedName = normalizeName(record).toLowerCase();
  if (normalizedName) {
    aliases.push(`name:${normalizedName}`);
  }

  return aliases;
}

function getWeekQueryFromEnv(): FantasyProsQueryParams {
  const week = process.env.FANTASYPROS_WEEK;
  if (!week) {
    return {};
  }

  const parsedWeek = Number.parseInt(week, 10);
  if (!Number.isFinite(parsedWeek) || parsedWeek <= 0) {
    console.warn('[getWeekQueryFromEnv] Invalid FANTASYPROS_WEEK value; skipping week query', { week });
    return {};
  }

  return { week: parsedWeek };
}

function mergeRecordsByKey(
  sourceRecords: FantasyProsRecord[],
  targetMap: Map<string, { key: string; records: Partial<Record<'player' | 'ranking' | 'projection' | 'injury', FantasyProsRecord>> }>,
  aliasToCanonicalKeyMap: Map<string, string>,
  sourceType: 'player' | 'ranking' | 'projection' | 'injury',
) {
  for (const record of sourceRecords) {
    const aliases = createAliases(record);
    if (aliases.length === 0) {
      continue;
    }

    const matchedCanonicals = Array.from(
      new Set(aliases.map((alias) => aliasToCanonicalKeyMap.get(alias)).filter((value): value is string => Boolean(value))),
    );

    const canonicalKey = matchedCanonicals[0] ?? aliases[0];

    if (matchedCanonicals.length > 1) {
      for (const duplicateCanonical of matchedCanonicals.slice(1)) {
        if (duplicateCanonical === canonicalKey) {
          continue;
        }

        const duplicateEntry = targetMap.get(duplicateCanonical);
        if (!duplicateEntry) {
          continue;
        }

        const primaryEntry = targetMap.get(canonicalKey) ?? { key: canonicalKey, records: {} };
        primaryEntry.records = { ...duplicateEntry.records, ...primaryEntry.records };
        targetMap.set(canonicalKey, primaryEntry);
        targetMap.delete(duplicateCanonical);

        for (const [alias, aliasCanonical] of aliasToCanonicalKeyMap.entries()) {
          if (aliasCanonical === duplicateCanonical) {
            aliasToCanonicalKeyMap.set(alias, canonicalKey);
          }
        }
      }
    }

    const current = targetMap.get(canonicalKey) ?? { key: canonicalKey, records: {} };
    current.records[sourceType] = record;
    targetMap.set(canonicalKey, current);

    for (const alias of aliases) {
      aliasToCanonicalKeyMap.set(alias, canonicalKey);
    }
  }
}

function buildDashboardPlayer(
  entry: { key: string; records: Partial<Record<'player' | 'ranking' | 'projection' | 'injury', FantasyProsRecord>> },
  fallbackIndex: number,
): DashboardPlayer {
  const playerRecord = (entry.records.player ?? {}) as PlayerInput;
  const rankingRecord = (entry.records.ranking ?? {}) as FantasyProsRankingRecord;
  const projectionRecord = (entry.records.projection ?? {}) as FantasyProsProjectionRecord;
  const injuryRecord = (entry.records.injury ?? {}) as FantasyProsInjuryRecord;

  const name =
    normalizeName(playerRecord) ||
    normalizeName(projectionRecord) ||
    normalizeName(rankingRecord) ||
    normalizeName(injuryRecord) ||
    `Player ${fallbackIndex + 1}`;

  const position =
    normalizePosition(playerRecord) ||
    normalizePosition(projectionRecord) ||
    normalizePosition(rankingRecord) ||
    normalizePosition(injuryRecord) ||
    'N/A';

  const projectedPoints =
    parseProjectedPoints(projectionRecord as Partial<PlayerInput>) || parseProjectedPoints(playerRecord);

  const overallRank = parseRank(
    rankingRecord.rank ??
      rankingRecord.rank_ecr ??
      rankingRecord.overall_rank ??
      rankingRecord.overallRank ??
      rankingRecord.ecr ??
      rankingRecord.position_rank,
  );

  const injuryStatus =
    (typeof injuryRecord.injury_status === 'string' && injuryRecord.injury_status) ||
    (typeof injuryRecord.status === 'string' && injuryRecord.status) ||
    null;

  const modelInput = {
    ...playerRecord,
    ...projectionRecord,
    name,
    position,
    projected_points: projectedPoints,
  };

  return {
    id: String(playerRecord.id ?? projectionRecord.id ?? rankingRecord.id ?? injuryRecord.id ?? entry.key),
    name,
    position,
    projectedPoints,
    overallRank,
    injuryStatus,
    customValueScore: calculatePlayerValue(modelInput),
    raw: {
      ...playerRecord,
      projection: projectionRecord,
      ranking: rankingRecord,
      injury: injuryRecord,
    },
  };
}

export function buildFullFantasyProsModel(input: {
  players: PlayerInput[];
  rankings: FantasyProsRankingRecord[];
  projections: FantasyProsProjectionRecord[];
  injuries: FantasyProsInjuryRecord[];
}): { players: DashboardPlayer[] } {
  const entityMap = new Map<
    string,
    { key: string; records: Partial<Record<'player' | 'ranking' | 'projection' | 'injury', FantasyProsRecord>> }
  >();
  const aliasToCanonicalKeyMap = new Map<string, string>();

  mergeRecordsByKey(input.players as FantasyProsRecord[], entityMap, aliasToCanonicalKeyMap, 'player');
  mergeRecordsByKey(input.rankings as FantasyProsRecord[], entityMap, aliasToCanonicalKeyMap, 'ranking');
  mergeRecordsByKey(input.projections as FantasyProsRecord[], entityMap, aliasToCanonicalKeyMap, 'projection');
  mergeRecordsByKey(input.injuries as FantasyProsRecord[], entityMap, aliasToCanonicalKeyMap, 'injury');

  const players = Array.from(entityMap.values()).map((entry, index) => buildDashboardPlayer(entry, index));

  console.log('[buildFullFantasyProsModel] Model merge completed', {
    sourcePlayers: input.players.length,
    sourceRankings: input.rankings.length,
    sourceProjections: input.projections.length,
    sourceInjuries: input.injuries.length,
    mergedPlayers: players.length,
  });

  return { players };
}

export type FantasyProsResult = {
  players: DashboardPlayer[];
  rawPayload: unknown;
  fetchedAtIso: string;
  errorMessage: string | null;
};

export async function getFantasyProsPlayers(): Promise<FantasyProsResult> {
  const query = getWeekQueryFromEnv();

  console.log('[getFantasyProsPlayers] Fetching full-model sources', { query });

  const [playersResult, rankingsResult, projectionsResult, injuriesResult] = await Promise.all([
    getFantasyProsPlayersFromApi(),
    getFantasyProsRankings(query),
    getFantasyProsProjections(query),
    getFantasyProsInjuries(query),
  ]);

  const model = buildFullFantasyProsModel({
    players: playersResult.items,
    rankings: rankingsResult.items,
    projections: projectionsResult.items,
    injuries: injuriesResult.items,
  });

  const errors = [
    playersResult.errorMessage,
    rankingsResult.errorMessage,
    projectionsResult.errorMessage,
    injuriesResult.errorMessage,
  ].filter((item): item is string => Boolean(item));

  const mergedErrorMessage = errors.length ? errors.join(' | ') : null;

  const fetchedAtIso = [playersResult, rankingsResult, projectionsResult, injuriesResult]
    .map((result) => result.fetchedAtIso)
    .sort()
    .at(-1) ?? new Date().toISOString();

  console.log('[getFantasyProsPlayers] Full model fetch complete', {
    mergedPlayers: model.players.length,
    sourceCounts: {
      players: playersResult.items.length,
      rankings: rankingsResult.items.length,
      projections: projectionsResult.items.length,
      injuries: injuriesResult.items.length,
    },
    hadErrors: Boolean(mergedErrorMessage),
  });

  return {
    players: model.players,
    rawPayload: {
      endpoints: {
        players: playersResult.endpoint,
        rankings: rankingsResult.endpoint,
        projections: projectionsResult.endpoint,
        injuries: injuriesResult.endpoint,
      },
      sourceCounts: {
        players: playersResult.items.length,
        rankings: rankingsResult.items.length,
        projections: projectionsResult.items.length,
        injuries: injuriesResult.items.length,
      },
      mergedCount: model.players.length,
      errors,
      payloads: {
        players: playersResult.rawPayload,
        rankings: rankingsResult.rawPayload,
        projections: projectionsResult.rawPayload,
        injuries: injuriesResult.rawPayload,
      },
    },
    fetchedAtIso,
    errorMessage: mergedErrorMessage,
  };
}

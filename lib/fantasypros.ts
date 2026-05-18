import {
  getFantasyProsInjuries,
  getFantasyProsPlayers as getFantasyProsPlayersFromApi,
  getFantasyProsProjections,
  getFantasyProsRankings,
} from '@/lib/fantasypros-client';
import {
  calculatePlayerValue,
  getProjectedReceivingYards,
  getTeamProjectionBaseline,
  isPassCatcherPosition,
  normalizeTeamAbbreviation,
} from '@/lib/model';
import type {
  FantasyProsInjuryRecord,
  FantasyProsProjectionRecord,
  FantasyProsQueryParams,
  FantasyProsRankingRecord,
  FantasyProsRecord,
} from '@/types/fantasypros';
import type { DashboardPlayer, PlayerInput } from '@/types/player';

function isKickerPosition(position: string): boolean {
  return position.trim().toUpperCase() === 'K';
}

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

function parseAdp(input: unknown): number | null {
  const adp = parseFloatSafe(input);
  if (!Number.isFinite(adp) || adp <= 0) {
    return null;
  }

  return Number.parseFloat(adp.toFixed(1));
}

function parseBooleanFlag(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1', 'rookie'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0', 'veteran'].includes(normalized)) return false;
  }

  return null;
}

function parseIsRookie(...records: Array<Partial<FantasyProsRecord> | undefined>): boolean {
  for (const record of records) {
    if (!record) {
      continue;
    }

    const recordValue =
      parseBooleanFlag(record.isRookie) ??
      parseBooleanFlag(record.is_rookie) ??
      parseBooleanFlag(record.rookie) ??
      parseBooleanFlag(record.is_rookie_year) ??
      parseBooleanFlag(record.rookie_year) ??
      parseBooleanFlag(record.first_year_player);

    if (recordValue !== null) {
      return recordValue;
    }

    const experience =
      record.years_exp ??
      record.yearsExperience ??
      record.experience ??
      record.exp ??
      record.nfl_exp ??
      record.season_experience;
    const parsedExperience = parseFloatSafe(experience);
    if (Number.isFinite(parsedExperience) && parsedExperience >= 0) {
      return parsedExperience === 0;
    }
  }

  return false;
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
  const normalizedPosition = normalizePosition(record);
  const normalizedTeam =
    ((typeof record.team_id === 'string' && record.team_id) ||
      (typeof record.team === 'string' && record.team) ||
      (typeof record.team_abbr === 'string' && record.team_abbr) ||
      '')
      .trim()
      .toUpperCase();

  if (normalizedName) {
    if (normalizedPosition) {
      aliases.push(`name-pos:${normalizedName}|${normalizedPosition}`);
    }

    if (normalizedTeam) {
      aliases.push(`name-team:${normalizedName}|${normalizedTeam}`);
    }

    if (normalizedPosition && normalizedTeam) {
      aliases.push(`name-pos-team:${normalizedName}|${normalizedPosition}|${normalizedTeam}`);
    }

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

function getScoringQueryFromEnv(): FantasyProsQueryParams {
  const scoring = process.env.FANTASYPROS_SCORING;

  if (!scoring) {
    return { scoring: 'PPR' };
  }

  return { scoring: scoring.toUpperCase() };
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

    const hasSpecificNameAlias = aliases.some((alias) => alias.startsWith('name-pos:') || alias.startsWith('name-team:') || alias.startsWith('name-pos-team:'));
    const specificAliases = aliases.filter((alias) => !alias.startsWith('name:'));

    const specificMatchedCanonicals = Array.from(
      new Set(
        specificAliases.map((alias) => aliasToCanonicalKeyMap.get(alias)).filter((value): value is string => Boolean(value)),
      ),
    );

    const matchedCanonicals = hasSpecificNameAlias
      ? specificMatchedCanonicals
      : Array.from(
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
  const adp = parseAdp(
    rankingRecord.adp ??
      rankingRecord.avg_adp ??
      rankingRecord.rank_avg ??
      projectionRecord.adp ??
      projectionRecord.avg_adp ??
      playerRecord.adp ??
      playerRecord.avg_adp,
  );

  const injuryStatus =
    (typeof injuryRecord.injury_status === 'string' && injuryRecord.injury_status) ||
    (typeof injuryRecord.status === 'string' && injuryRecord.status) ||
    null;
  const isRookie = parseIsRookie(playerRecord, rankingRecord, projectionRecord, injuryRecord);

  const modelInput = {
    ...playerRecord,
    ...projectionRecord,
    name,
    position,
    isRookie,
    projected_points: projectedPoints,
  };

  const valueProjection = calculatePlayerValue(modelInput);

  return {
    id: String(playerRecord.id ?? projectionRecord.id ?? rankingRecord.id ?? injuryRecord.id ?? entry.key),
    name,
    position,
    isRookie,
    projectedPoints,
    adp,
    overallRank,
    injuryStatus,
    customValueScore: valueProjection.median,
    raw: {
      ...playerRecord,
      valueProjection,
      projection: projectionRecord,
      ranking: rankingRecord,
      injury: injuryRecord,
    },
  };
}

function getTeamFromEntry(
  entry: { key: string; records: Partial<Record<'player' | 'ranking' | 'projection' | 'injury', FantasyProsRecord>> },
): string | null {
  const sources = [entry.records.player, entry.records.projection, entry.records.ranking, entry.records.injury];

  for (const source of sources) {
    const normalizedTeam = normalizeTeamAbbreviation(
      source?.team_id ?? source?.team ?? source?.team_abbr ?? source?.team_abbreviation,
    );

    if (normalizedTeam) {
      return normalizedTeam;
    }
  }

  return null;
}

function applyTeamPieScaling(
  players: DashboardPlayer[],
  mergedEntries: Array<{
    key: string;
    records: Partial<Record<'player' | 'ranking' | 'projection' | 'injury', FantasyProsRecord>>;
  }>,
) {
  const teamBuckets = new Map<
    string,
    Array<{
      player: DashboardPlayer;
      receivingYards: number;
    }>
  >();

  players.forEach((player, index) => {
    if (!isPassCatcherPosition(player.position)) {
      return;
    }

    const entry = mergedEntries[index];
    if (!entry) {
      return;
    }

    const team = getTeamFromEntry(entry);
    if (!team) {
      return;
    }

    const receivingYards = getProjectedReceivingYards({
      ...(entry.records.player ?? {}),
      ...(entry.records.projection ?? {}),
    } as PlayerInput);

    if (receivingYards <= 0) {
      return;
    }

    const current = teamBuckets.get(team) ?? [];
    current.push({ player, receivingYards });
    teamBuckets.set(team, current);
  });

  for (const [team, passCatchers] of teamBuckets.entries()) {
    const totalReceivingYards = passCatchers.reduce((sum, passCatcher) => sum + passCatcher.receivingYards, 0);
    const teamBaseline = getTeamProjectionBaseline(team);

    if (totalReceivingYards <= 0 || totalReceivingYards <= teamBaseline.passingYards) {
      continue;
    }

    const scaleFactor = teamBaseline.passingYards / totalReceivingYards;

    for (const passCatcher of passCatchers) {
      const scaledProjectedPoints = Number.parseFloat((passCatcher.player.projectedPoints * scaleFactor).toFixed(2));
      passCatcher.player.projectedPoints = scaledProjectedPoints;

      const valueProjection = calculatePlayerValue({
        ...passCatcher.player.raw,
        name: passCatcher.player.name,
        position: passCatcher.player.position,
        projected_points: scaledProjectedPoints,
      });
      passCatcher.player.customValueScore = valueProjection.median;
      passCatcher.player.raw = {
        ...passCatcher.player.raw,
        valueProjection,
        teamPieScaling: {
          team,
          totalReceivingYards: Number.parseFloat(totalReceivingYards.toFixed(1)),
          teamPassingBaseline: teamBaseline.passingYards,
          scaleFactor: Number.parseFloat(scaleFactor.toFixed(4)),
        },
      };
    }

    console.log('[buildFullFantasyProsModel] Applied team pie scaling', {
      team,
      passCatchersScaled: passCatchers.length,
      totalReceivingYards: Number.parseFloat(totalReceivingYards.toFixed(1)),
      teamPassingBaseline: teamBaseline.passingYards,
      scaleFactor: Number.parseFloat(scaleFactor.toFixed(4)),
    });
  }
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

  const mergedEntries = Array.from(entityMap.values());
  const mergedPlayers = mergedEntries.map((entry, index) => buildDashboardPlayer(entry, index));
  applyTeamPieScaling(mergedPlayers, mergedEntries);
  const players = mergedPlayers.filter((player, index) => {
    if (isKickerPosition(player.position)) {
      return false;
    }

    const entry = mergedEntries[index];
    const hasBasePlayerRecord = Boolean(entry?.records.player);

    return hasBasePlayerRecord || player.overallRank !== null || player.projectedPoints > 0 || Boolean(player.injuryStatus);
  });

  console.log('[buildFullFantasyProsModel] Model merge completed', {
    sourcePlayers: input.players.length,
    sourceRankings: input.rankings.length,
    sourceProjections: input.projections.length,
    sourceInjuries: input.injuries.length,
    mergedPlayersBeforeFiltering: mergedPlayers.length,
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

export async function getFantasyProsPlayers(options?: { forceRefresh?: boolean }): Promise<FantasyProsResult> {
  const weekQuery = getWeekQueryFromEnv();
  const scoringQuery = getScoringQueryFromEnv();
  const rankingsAndProjectionsQuery = { ...weekQuery, ...scoringQuery };

  console.log('[getFantasyProsPlayers] Fetching full-model sources', {
    weekQuery,
    scoringQuery,
    forceRefresh: Boolean(options?.forceRefresh),
  });

  const [playersResult, rankingsResult, projectionsResult, injuriesResult] = await Promise.all([
    getFantasyProsPlayersFromApi({
      ecr: 'included',
      show: 'pos_rank',
    }, { forceFresh: options?.forceRefresh }),
    getFantasyProsRankings(rankingsAndProjectionsQuery, { forceFresh: options?.forceRefresh }),
    getFantasyProsProjections({
      ...rankingsAndProjectionsQuery,
    }, { forceFresh: options?.forceRefresh }),
    getFantasyProsInjuries(weekQuery, { forceFresh: options?.forceRefresh }),
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

'use client';

import React, { useMemo, useState } from 'react';

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
  isRookie?: boolean;
  ecr?: number;
  adp?: number;
  proj_pts?: number;
  advancedFields?: Record<string, unknown>;
};

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'DST'] as const;
type PositionFilter = (typeof POSITIONS)[number];
type SortDirection = 'asc' | 'desc';
type SortKey = 'name' | 'team' | 'position' | 'ecr' | 'proj_pts' | `advanced:${string}`;
type SortConfig = { key: SortKey; direction: SortDirection };
type AdvancedColumnOption = {
  path: string;
  valueCount: number;
};
type DraftablePosition = 'QB' | 'RB' | 'WR' | 'TE';
type DraftSlotBucket = 'early' | 'middle' | 'late';
export type RosterSettings = {
  teamCount: number;
  starters: Record<DraftablePosition, number>;
  flexSpots: number;
  flexEligible: DraftablePosition[];
  benchModifier: Record<DraftablePosition, number>;
};
type DraftScoredPlayer = Player & {
  draftScore: number;
  vorp: number;
  floorVorp: number;
  ceilingVorp: number;
  tier: number;
  floorPoints: number;
  ceilingPoints: number;
  upsideProbability: number;
  valueGap: number;
  expectedGamesPlayed: number;
  expectedOverallPick: number;
};
type DraftTab = 'player-rankings' | 'draft-board';
type DraftMode = 'safe-floor' | 'matchup-winning-ceiling';
type DraftBoardRow = {
  round: number;
  overallPick: number;
  strategy: string;
  primary: DraftScoredPlayer | null;
  primaryHasStack: boolean;
  likelyPick: DraftScoredPlayer | null;
  alternatives: DraftScoredPlayer[];
};
type LeagueScoringProfile = {
  passingYardsPerPoint: number;
  passingTd: number;
  passInterception: number;
  pickSixThrown: number;
  rushingYardsPerPoint: number;
  rushingTd: number;
  receivingYardsPerPoint: number;
  receivingTd: number;
  twoPointConversion: number;
  fumbleLost: number;
  passingBonus300: number;
  passingBonus400: number;
  rushingBonus100: number;
  rushingBonus200: number;
  receivingBonus100: number;
  receivingBonus200: number;
};

export const DEFAULT_ROSTER_SETTINGS: RosterSettings = {
  teamCount: 12,
  starters: {
    QB: 1,
    RB: 2,
    WR: 3,
    TE: 1,
  },
  flexSpots: 1,
  flexEligible: ['RB', 'WR', 'TE'],
  benchModifier: {
    QB: 0.25,
    RB: 0.58,
    WR: 0.58,
    TE: 0.25,
  },
};

const DRAFT_TEAM_COUNT = DEFAULT_ROSTER_SETTINGS.teamCount;
const DRAFT_ROUNDS = 12;
const DRAFT_POSITIONS = Array.from({ length: DRAFT_TEAM_COUNT }, (_, index) => index + 1);
const LEAGUE_SCORING: LeagueScoringProfile = {
  passingYardsPerPoint: 25,
  passingTd: 5,
  passInterception: -1,
  pickSixThrown: -3,
  rushingYardsPerPoint: 10,
  rushingTd: 6,
  receivingYardsPerPoint: 10,
  receivingTd: 6,
  twoPointConversion: 2,
  fumbleLost: -1,
  passingBonus300: 1,
  passingBonus400: 2,
  rushingBonus100: 1,
  rushingBonus200: 2,
  receivingBonus100: 1,
  receivingBonus200: 2,
};

const STAT_PATHS = {
  passYards: ['pass_yds', 'passing_yds', 'passing_yards', 'projection.pass_yds', 'projection.passing_yds'],
  passTd: ['pass_td', 'passing_tds', 'passing_td', 'projection.pass_td', 'projection.passing_td'],
  passInterceptions: ['interceptions', 'pass_int', 'ints', 'projection.interceptions'],
  pickSixThrown: ['pick_six_thrown', 'pick6_thrown', 'pick_6_thrown'],
  rushYards: ['rush_yds', 'rushing_yds', 'rushing_yards', 'projection.rush_yds', 'projection.rushing_yds'],
  rushTd: ['rush_td', 'rushing_tds', 'rushing_td', 'projection.rush_td', 'projection.rushing_td'],
  recYards: ['rec_yds', 'receiving_yds', 'receiving_yards', 'projection.rec_yds', 'projection.receiving_yds'],
  recTd: ['rec_td', 'receiving_tds', 'receiving_td', 'projection.rec_td', 'projection.receiving_td'],
  twoPoint: ['two_pt', 'two_point', '2pt', 'two_point_conversions'],
  fumblesLost: ['fumbles_lost', 'fumble_lost'],
  redZoneTargets: [
    'red_zone_targets',
    'redZoneTargets',
    'projection.red_zone_targets',
    'projection.redZoneTargets',
  ],
  greenZoneTouches: [
    'green_zone_touches',
    'greenZoneTouches',
    'carries_inside_5',
    'carriesInside5',
    'projection.green_zone_touches',
    'projection.greenZoneTouches',
  ],
  greenZoneTouchesPerGame: [
    'green_zone_touches_per_game',
    'greenZoneTouchesPerGame',
    'projection.green_zone_touches_per_game',
    'projection.greenZoneTouchesPerGame',
  ],
  targetShare: ['target_share', 'targetShare', 'projection.target_share', 'projection.targetShare'],
  targetsPerRouteRun: [
    'targets_per_route_run',
    'targetsPerRouteRun',
    'tprr',
    'projection.targets_per_route_run',
    'projection.targetsPerRouteRun',
    'projection.tprr',
  ],
  yprr: ['yprr', 'yards_per_route_run', 'yardsPerRouteRun', 'projection.yprr', 'projection.yards_per_route_run'],
  gamesPlayed: ['games_played', 'gamesPlayed', 'projection.games_played', 'projection.gamesPlayed'],
} as const;

const HIGH_LEVERAGE_USAGE_MULTIPLIER = 1.08;
const STACK_CORRELATION_BOOST = 2.5;
const BREAKOUT_COEFFICIENT = 1.15;
const ROOKIE_LATE_SEASON_BREAKOUT_COEFFICIENT = 1.2;
const ROOKIE_DRAFT_SCORE_BOOST = 1.5;
const TIER_BREAK_GAP_POINTS = 1.5;
const TIER_DROP_WARNING_BOOST = 3.0;
const POSITION_VARIANCE_POINTS: Record<DraftablePosition, number> = {
  QB: 4.5,
  RB: 5.8,
  WR: 6.2,
  TE: 5,
};
const BASE_UPSIDE_PROBABILITY: Record<DraftablePosition, number> = {
  QB: 26,
  RB: 33,
  WR: 37,
  TE: 30,
};
const SYNTHETIC_ADVANCED_COLUMN_PATHS = [
  'is_rookie',
  'target_share',
  'red_zone_targets',
  'green_zone_touches',
  'green_zone_touches_per_game',
  'targets_per_route_run',
  'yprr',
] as const;

function isDraftablePosition(position: string): position is DraftablePosition {
  return position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE';
}

function isStackablePosition(position: string): position is 'QB' | 'WR' | 'TE' {
  return position === 'QB' || position === 'WR' || position === 'TE';
}

function isEliteTightEnd(player: DraftScoredPlayer): boolean {
  return player.position === 'TE' && player.expectedOverallPick <= 42;
}

function isRookieUpsidePosition(position: string): position is 'RB' | 'WR' {
  return position === 'RB' || position === 'WR';
}

function hasRookieUpsideProfile(player: Pick<Player, 'position' | 'isRookie'>): boolean {
  return Boolean(player.isRookie) && isRookieUpsidePosition(player.position);
}

type TierInputPlayer = {
  id: string;
  position: DraftablePosition;
  leagueAdjustedPoints: number;
};

export function assignPlayerTiers(players: TierInputPlayer[], tierBreakGapPoints = TIER_BREAK_GAP_POINTS): Map<string, number> {
  const playersByPosition: Record<DraftablePosition, TierInputPlayer[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
  };

  for (const player of players) {
    playersByPosition[player.position].push(player);
  }

  const tiersByPlayerId = new Map<string, number>();

  (Object.keys(playersByPosition) as DraftablePosition[]).forEach((position) => {
    const sortedPlayers = [...playersByPosition[position]].sort((a, b) => b.leagueAdjustedPoints - a.leagueAdjustedPoints);

    if (sortedPlayers.length === 0) {
      return;
    }

    let currentTier = 1;
    tiersByPlayerId.set(sortedPlayers[0].id, currentTier);

    for (let index = 1; index < sortedPlayers.length; index += 1) {
      const previousPlayer = sortedPlayers[index - 1];
      const currentPlayer = sortedPlayers[index];
      const pointsGap = previousPlayer.leagueAdjustedPoints - currentPlayer.leagueAdjustedPoints;

      if (pointsGap > tierBreakGapPoints) {
        currentTier += 1;
      }

      tiersByPlayerId.set(currentPlayer.id, currentTier);
    }
  });

  return tiersByPlayerId;
}

export function calculateReplacementRanks(settings: RosterSettings): Record<DraftablePosition, number> {
  const flexSharePerPosition =
    settings.flexEligible.length > 0 ? settings.flexSpots / settings.flexEligible.length : 0;

  const replacementRanks = {
    QB: 1,
    RB: 1,
    WR: 1,
    TE: 1,
  } satisfies Record<DraftablePosition, number>;

  (Object.keys(replacementRanks) as DraftablePosition[]).forEach((position) => {
    const starterCount = settings.starters[position];
    const flexShare = settings.flexEligible.includes(position) ? flexSharePerPosition : 0;
    const benchShare = settings.benchModifier[position];
    const replacementRank = Math.ceil(settings.teamCount * (starterCount + flexShare + benchShare));
    replacementRanks[position] = Math.max(1, replacementRank);
  });

  return replacementRanks;
}

function calculateSnakePick(round: number, draftPosition: number, teamCount: number): number {
  if (round % 2 === 1) {
    return (round - 1) * teamCount + draftPosition;
  }

  return round * teamCount - draftPosition + 1;
}

function getDraftSlotBucket(draftPosition: number): DraftSlotBucket {
  if (draftPosition <= 4) return 'early';
  if (draftPosition <= 8) return 'middle';
  return 'late';
}

function getRoundStrategy(round: number, draftPosition: number): string {
  const slotBucket = getDraftSlotBucket(draftPosition);

  if (round === 1) {
    if (slotBucket === 'early') return 'Hero RB start: secure elite RB/WR anchor';
    if (slotBucket === 'middle') return 'Balanced anchor: best RB/WR value on board';
    return 'Elite WR start: leverage late-slot turn volatility';
  }

  if (round === 2) {
    if (slotBucket === 'late') return 'Double-tap WR or add elite TE if tier-1 falls';
    return 'Add WR1/RB2 volume; monitor elite TE value pocket';
  }

  if (round <= 4) return 'Stability phase: prioritize floor VORP and avoid fragile profiles';
  if (round <= 6) return 'RB/WR value core; prioritize rushing-QB value lane';
  if (round <= 9) return 'Upside phase starts: shift toward ceiling VORP bets';
  return 'Upside bench build; delay DST and streamable positions';
}

function getInjuryPenalty(advancedFields: Record<string, unknown> | undefined): number {
  const injuryText = String(
    advancedFields?.injuryStatus ?? advancedFields?.injury_status ?? advancedFields?.status ?? '',
  ).toLowerCase();

  if (!injuryText || injuryText === 'null' || injuryText === 'none' || injuryText === 'healthy') {
    return 16.5;
  }

  if (injuryText.includes('questionable')) return 15;
  if (injuryText.includes('doubtful')) return 13.5;
  if (injuryText.includes('out')) return 12;
  if (injuryText.includes('ir') || injuryText.includes('reserve') || injuryText.includes('pup')) return 10;
  return 15.5;
}

function getPlayoffStrengthOfScheduleShift(advancedFields: Record<string, unknown> | undefined): number {
  const scheduleValue =
    getValueAtPath(advancedFields, 'strengthOfSchedule') ??
    getValueAtPath(advancedFields, 'playoffStrengthOfSchedule') ??
    getValueAtPath(advancedFields, 'playoff_schedule_difficulty') ??
    getValueAtPath(advancedFields, 'weeks15to17StrengthOfSchedule') ??
    getValueAtPath(advancedFields, 'playoffSchedule');

  if (typeof scheduleValue === 'string') {
    const normalized = scheduleValue.toLowerCase();
    if (
      normalized.includes('hard') ||
      normalized.includes('difficult') ||
      normalized.includes('tough') ||
      normalized.includes('unfavorable')
    ) {
      return -0.05;
    }
    if (
      normalized.includes('easy') ||
      normalized.includes('favorable') ||
      normalized.includes('soft') ||
      normalized.includes('good')
    ) {
      return 0.05;
    }
    return 0;
  }

  const numeric = toNumber(scheduleValue);
  if (numeric === null || numeric === 0) {
    return 0;
  }

  // Supports multiple scale types:
  // - signed scores around zero
  // - 1-5 buckets (1 easy, 5 hard)
  // - 1-32 difficulty ranking (lower easier, higher harder)
  if (numeric >= -1 && numeric <= 1) {
    return numeric > 0 ? -0.05 : 0.05;
  }

  if (numeric >= 1 && numeric <= 5) {
    if (numeric >= 4) return -0.05;
    if (numeric <= 2) return 0.05;
    return 0;
  }

  if (numeric >= 1 && numeric <= 32) {
    if (numeric >= 22) return -0.05;
    if (numeric <= 11) return 0.05;
    return 0;
  }

  return numeric > 0 ? -0.05 : 0.05;
}

function flattenFieldPaths(value: unknown, prefix = '', into: Set<string>) {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      const nextPrefix = prefix ? `${prefix}.${index}` : String(index);
      flattenFieldPaths(item, nextPrefix, into);
    }
    return;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, nestedValue] of entries) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenFieldPaths(nestedValue, nextPrefix, into);
    }
    return;
  }

  if (prefix) {
    into.add(prefix);
  }
}

function getValueAtPathRaw(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) {
    return undefined;
  }

  const segments = path.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

function getValueAtPath(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) {
    return undefined;
  }

  if (path === 'is_rookie') {
    return (
      getValueAtPathRaw(source, 'isRookie') ??
      getValueAtPathRaw(source, 'is_rookie') ??
      getValueAtPathRaw(source, 'rookie')
    );
  }

  if (path === 'target_share') {
    return getStatNumber(source, STAT_PATHS.targetShare) ?? undefined;
  }

  if (path === 'red_zone_targets') {
    return getStatNumber(source, STAT_PATHS.redZoneTargets) ?? undefined;
  }

  if (path === 'green_zone_touches') {
    return getStatNumber(source, STAT_PATHS.greenZoneTouches) ?? undefined;
  }

  if (path === 'green_zone_touches_per_game') {
    return getGreenZoneTouchesPerGame(source) ?? undefined;
  }

  if (path === 'targets_per_route_run') {
    return getStatNumber(source, STAT_PATHS.targetsPerRouteRun) ?? undefined;
  }

  if (path === 'yprr') {
    return getStatNumber(source, STAT_PATHS.yprr) ?? undefined;
  }

  return getValueAtPathRaw(source, path);
}

function formatAdvancedValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function sanitizePathForTestId(path: string): string {
  return path.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSortValue(player: Player, key: SortKey): unknown {
  if (key === 'name') return player.name;
  if (key === 'team') return player.team;
  if (key === 'position') return player.position;
  if (key === 'ecr') return player.ecr;
  if (key === 'proj_pts') return player.proj_pts;
  if (key.startsWith('advanced:')) {
    const path = key.slice('advanced:'.length);
    return getValueAtPath(player.advancedFields, path);
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getNumberAtAnyPath(source: Record<string, unknown> | undefined, paths: readonly string[]): number | null {
  for (const path of paths) {
    const value = getValueAtPathRaw(source, path);
    const parsed = toNumber(value);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function getStatNumber(source: Record<string, unknown> | undefined, statPaths: readonly string[]): number | null {
  const direct = getNumberAtAnyPath(source, statPaths);
  if (direct !== null) {
    return direct;
  }

  const statsArray = getValueAtPath(source, 'projection.stats');
  if (!Array.isArray(statsArray)) {
    return null;
  }

  for (const statEntry of statsArray) {
    if (statEntry && typeof statEntry === 'object') {
      const entryRecord = statEntry as Record<string, unknown>;
      for (const path of statPaths) {
        const key = path.split('.').at(-1) ?? path;
        const parsed = toNumber(entryRecord[key]);
        if (parsed !== null) {
          return parsed;
        }
      }
    }
  }

  return null;
}

function normalizeTargetShare(targetShare: number | null): number | null {
  if (targetShare === null || targetShare < 0) {
    return null;
  }

  if (targetShare > 1) {
    return targetShare / 100;
  }

  return targetShare;
}

function getGreenZoneTouchesPerGame(source: Record<string, unknown> | undefined): number | null {
  const directPerGame = getStatNumber(source, STAT_PATHS.greenZoneTouchesPerGame);
  if (directPerGame !== null) {
    return directPerGame;
  }

  const touches = getStatNumber(source, STAT_PATHS.greenZoneTouches);
  const gamesPlayed = getStatNumber(source, STAT_PATHS.gamesPlayed);
  if (touches === null || gamesPlayed === null || gamesPlayed <= 0) {
    return null;
  }

  return touches / gamesPlayed;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function computeLeagueAdjustedProjection(player: Player): {
  medianPoints: number;
  floorPoints: number;
  ceilingPoints: number;
  upsideProbability: number;
  usedDetailedStats: boolean;
  rookieLateSeasonBreakoutApplied: boolean;
} {
  const baseProjection = typeof player.proj_pts === 'number' ? player.proj_pts : 0;
  const source = player.advancedFields;
  const expectedGamesPlayed = getInjuryPenalty(source);
  const availabilityMultiplier = expectedGamesPlayed / 17;
  const playoffScheduleShift = getPlayoffStrengthOfScheduleShift(source);
  const playoffScheduleMultiplier = 1 + playoffScheduleShift;

  const passYards = getStatNumber(source, STAT_PATHS.passYards);
  const passTd = getStatNumber(source, STAT_PATHS.passTd);
  const passInterceptions = getStatNumber(source, STAT_PATHS.passInterceptions);
  const pickSixThrown = getStatNumber(source, STAT_PATHS.pickSixThrown);
  const rushYards = getStatNumber(source, STAT_PATHS.rushYards);
  const rushTd = getStatNumber(source, STAT_PATHS.rushTd);
  const recYards = getStatNumber(source, STAT_PATHS.recYards);
  const recTd = getStatNumber(source, STAT_PATHS.recTd);
  const twoPoint = getStatNumber(source, STAT_PATHS.twoPoint);
  const fumblesLost = getStatNumber(source, STAT_PATHS.fumblesLost);
  const redZoneTargets = getStatNumber(source, STAT_PATHS.redZoneTargets);
  const targetShare = normalizeTargetShare(getStatNumber(source, STAT_PATHS.targetShare));
  const greenZoneTouchesPerGame = getGreenZoneTouchesPerGame(source);

  const hasDetailedStats = [
    passYards,
    passTd,
    passInterceptions,
    pickSixThrown,
    rushYards,
    rushTd,
    recYards,
    recTd,
    twoPoint,
    fumblesLost,
  ].some((value) => value !== null);

  const position = isDraftablePosition(player.position) ? player.position : 'WR';
  const positionVariance = POSITION_VARIANCE_POINTS[position];
  let medianPoints = 0;
  let hasHighLeverageUsage = false;

  if (hasDetailedStats) {
    medianPoints += (passYards ?? 0) / LEAGUE_SCORING.passingYardsPerPoint;
    medianPoints += (passTd ?? 0) * LEAGUE_SCORING.passingTd;
    medianPoints += (passInterceptions ?? 0) * LEAGUE_SCORING.passInterception;
    medianPoints += (pickSixThrown ?? 0) * LEAGUE_SCORING.pickSixThrown;
    medianPoints += (rushYards ?? 0) / LEAGUE_SCORING.rushingYardsPerPoint;
    medianPoints += (rushTd ?? 0) * LEAGUE_SCORING.rushingTd;
    medianPoints += (recYards ?? 0) / LEAGUE_SCORING.receivingYardsPerPoint;
    medianPoints += (recTd ?? 0) * LEAGUE_SCORING.receivingTd;
    medianPoints += (twoPoint ?? 0) * LEAGUE_SCORING.twoPointConversion;
    medianPoints += (fumblesLost ?? 0) * LEAGUE_SCORING.fumbleLost;

    if ((passYards ?? 0) >= 400) {
      medianPoints += LEAGUE_SCORING.passingBonus400;
    } else if ((passYards ?? 0) >= 300) {
      medianPoints += LEAGUE_SCORING.passingBonus300;
    }

    if ((rushYards ?? 0) >= 200) {
      medianPoints += LEAGUE_SCORING.rushingBonus200;
    } else if ((rushYards ?? 0) >= 100) {
      medianPoints += LEAGUE_SCORING.rushingBonus100;
    }

    if ((recYards ?? 0) >= 200) {
      medianPoints += LEAGUE_SCORING.receivingBonus200;
    } else if ((recYards ?? 0) >= 100) {
      medianPoints += LEAGUE_SCORING.receivingBonus100;
    }

    hasHighLeverageUsage = (targetShare ?? 0) > 0.25 || (greenZoneTouchesPerGame ?? 0) > 1.5;
    if (hasHighLeverageUsage) {
      medianPoints *= HIGH_LEVERAGE_USAGE_MULTIPLIER;
    }

    medianPoints *= availabilityMultiplier;
    medianPoints *= playoffScheduleMultiplier;

    console.log('[computeLeagueAdjustedProjection] advanced leverage and context signals', {
      player: player.name,
      targetShare,
      redZoneTargets,
      greenZoneTouchesPerGame,
      highLeverageUsage: hasHighLeverageUsage,
      expectedGamesPlayed,
      availabilityMultiplier,
      playoffScheduleShift,
      playoffScheduleMultiplier,
    });
  } else {
    const fallbackMultiplierMap: Record<DraftablePosition, number> = {
      QB: 1.07,
      RB: 1.04,
      WR: 0.98,
      TE: 0.95,
    };

    medianPoints = baseProjection * fallbackMultiplierMap[position] * availabilityMultiplier * playoffScheduleMultiplier;

    console.log('[computeLeagueAdjustedProjection] fallback context signals', {
      player: player.name,
      expectedGamesPlayed,
      availabilityMultiplier,
      playoffScheduleShift,
      playoffScheduleMultiplier,
    });
  }

  const median = Number.parseFloat(Math.max(0, medianPoints).toFixed(2));
  const floor = Number.parseFloat(Math.max(0, median - positionVariance).toFixed(2));
  const baseCeiling = median + positionVariance;
  const rookieLateSeasonBreakoutApplied = hasRookieUpsideProfile(player);
  const ceiling = Number.parseFloat(
    (rookieLateSeasonBreakoutApplied ? baseCeiling * ROOKIE_LATE_SEASON_BREAKOUT_COEFFICIENT : baseCeiling).toFixed(2),
  );
  const leverageBonus = hasHighLeverageUsage ? 8 : 0;
  const targetShareBonus = (targetShare ?? 0) > 0.25 ? 6 : 0;
  const greenZoneBonus = (greenZoneTouchesPerGame ?? 0) > 1.5 ? 5 : 0;
  const durabilityPenalty = Math.max(0, 16.5 - expectedGamesPlayed) * 2;
  const upsideProbability = Number.parseFloat(
    clamp(
      BASE_UPSIDE_PROBABILITY[position] + leverageBonus + targetShareBonus + greenZoneBonus - durabilityPenalty,
      5,
      95,
    ).toFixed(1),
  );

  return {
    medianPoints: median,
    floorPoints: floor,
    ceilingPoints: ceiling,
    upsideProbability,
    usedDetailedStats: hasDetailedStats,
    rookieLateSeasonBreakoutApplied,
  };
}

function compareValues(a: Player, b: Player, key: SortKey, direction: SortDirection): number {
  const valueA = getSortValue(a, key);
  const valueB = getSortValue(b, key);

  const isMissingA = valueA === undefined || valueA === null || valueA === '';
  const isMissingB = valueB === undefined || valueB === null || valueB === '';

  if (isMissingA && !isMissingB) return 1;
  if (!isMissingA && isMissingB) return -1;
  if (isMissingA && isMissingB) return 0;

  if (typeof valueA === 'number' && typeof valueB === 'number') {
    if (valueA < valueB) return direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return direction === 'asc' ? 1 : -1;
    return 0;
  }

  const textA = String(valueA).toLowerCase();
  const textB = String(valueB).toLowerCase();
  const result = textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

export default function DashboardClient({ initialData }: { initialData: Player[] }) {
  const rosterSettings = DEFAULT_ROSTER_SETTINGS;
  const [liveData, setLiveData] = useState<Player[]>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [lastRefreshIso, setLastRefreshIso] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);
  const [selectedAdvancedColumns, setSelectedAdvancedColumns] = useState<string[]>([
    ...SYNTHETIC_ADVANCED_COLUMN_PATHS,
  ]);
  const [draftPosition, setDraftPosition] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<DraftTab>('player-rankings');
  const [draftMode, setDraftMode] = useState<DraftMode>('safe-floor');

  const lastRefreshLabel = useMemo(() => {
    if (!lastRefreshIso) {
      return null;
    }

    const parsedDate = new Date(lastRefreshIso);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [lastRefreshIso]);

  const advancedColumnOptions = useMemo<AdvancedColumnOption[]>(() => {
    const pathSet = new Set<string>();

    for (const player of liveData) {
      flattenFieldPaths(player.advancedFields, '', pathSet);
    }

    for (const syntheticPath of SYNTHETIC_ADVANCED_COLUMN_PATHS) {
      const hasValue = liveData.some((player) => getValueAtPath(player.advancedFields, syntheticPath) !== undefined);
      if (hasValue) {
        pathSet.add(syntheticPath);
      }
    }

    const paths = Array.from(pathSet).sort((a, b) => a.localeCompare(b));
    return paths.map((path) => ({
      path,
      valueCount: liveData.filter((player) => getValueAtPath(player.advancedFields, path) !== undefined).length,
    }));
  }, [liveData]);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const response = await fetch('/api/fantasypros/refresh', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        players?: Player[];
        fetchedAtIso?: string;
        errorMessage?: string | null;
      };

      if (Array.isArray(payload.players)) {
        setLiveData(payload.players);
      } else {
        throw new Error('Refresh response did not include player data.');
      }

      setLastRefreshIso(payload.fetchedAtIso ?? new Date().toISOString());
      if (payload.errorMessage) {
        setRefreshError(payload.errorMessage);
      }

      console.log('[DashboardClient] manual refresh completed', {
        refreshedPlayers: payload.players.length,
        fetchedAtIso: payload.fetchedAtIso ?? null,
        hadSourceErrors: Boolean(payload.errorMessage),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh FantasyPros data.';
      setRefreshError(message);
      console.error('[DashboardClient] manual refresh failed', { error });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    console.log('[DashboardClient] handleSort', { key, direction });
    setSortConfig({ key, direction });
  };

  const handleAdvancedColumnToggle = (path: string) => {
    setSelectedAdvancedColumns((previous) => {
      if (previous.includes(path)) {
        console.log('[DashboardClient] advanced column removed', { path });
        return previous.filter((item) => item !== path);
      }

      console.log('[DashboardClient] advanced column added', { path });
      return [...previous, path];
    });
  };

  const filteredAndSortedData = useMemo(() => {
    console.log('[DashboardClient] deriving table data', {
      initialCount: liveData.length,
      search,
      positionFilter,
      sortKey: sortConfig?.key ?? null,
      sortDirection: sortConfig?.direction ?? null,
    });

    let filtered = [...liveData];

    if (search) {
      filtered = filtered.filter((player) => player.name.toLowerCase().includes(search.toLowerCase()));
      console.log('[DashboardClient] search filter applied', { resultCount: filtered.length });
    }

    if (positionFilter !== 'ALL') {
      filtered = filtered.filter((player) => player.position === positionFilter);
      console.log('[DashboardClient] position filter applied', { positionFilter, resultCount: filtered.length });
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => compareValues(a, b, sortConfig.key, sortConfig.direction));
      console.log('[DashboardClient] sort applied', { key: sortConfig.key, direction: sortConfig.direction });
    }

    return filtered;
  }, [liveData, search, positionFilter, sortConfig]);

  const draftRankedPlayers = useMemo<DraftScoredPlayer[]>(() => {
    const draftPool = liveData.filter(
      (player) => isDraftablePosition(player.position) && typeof player.proj_pts === 'number',
    ) as Array<Player & { position: DraftablePosition; proj_pts: number }>;

    console.log('[DashboardClient] building draft player scores', {
      initialPlayerCount: liveData.length,
      draftablePlayerCount: draftPool.length,
    });

    if (draftPool.length === 0) {
      return [];
    }

    const enhancedDraftPool = draftPool.map((player) => {
      const projectionDistribution = computeLeagueAdjustedProjection(player);
      return {
        ...player,
        leagueAdjustedPoints: projectionDistribution.medianPoints,
        usedDetailedStats: projectionDistribution.usedDetailedStats,
        floorPoints: projectionDistribution.floorPoints,
        ceilingPoints: projectionDistribution.ceilingPoints,
        upsideProbability: projectionDistribution.upsideProbability,
      };
    });

    const byPosition: Record<DraftablePosition, Array<(typeof enhancedDraftPool)[number]>> = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
    };

    for (const player of enhancedDraftPool) {
      byPosition[player.position].push(player);
    }

    for (const position of Object.keys(byPosition) as DraftablePosition[]) {
      byPosition[position].sort((a, b) => b.leagueAdjustedPoints - a.leagueAdjustedPoints);
    }

    const replacementRanks = calculateReplacementRanks(rosterSettings);
    const replacementPoints = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
    } satisfies Record<DraftablePosition, number>;
    const replacementFloorPoints = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
    } satisfies Record<DraftablePosition, number>;
    const replacementCeilingPoints = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
    } satisfies Record<DraftablePosition, number>;

    (Object.keys(replacementPoints) as DraftablePosition[]).forEach((position) => {
      const floorSorted = [...byPosition[position]].sort((a, b) => b.floorPoints - a.floorPoints);
      const ceilingSorted = [...byPosition[position]].sort((a, b) => b.ceilingPoints - a.ceilingPoints);

      replacementPoints[position] =
        byPosition[position][replacementRanks[position] - 1]?.leagueAdjustedPoints ??
        byPosition[position].at(-1)?.leagueAdjustedPoints ??
        0;
      replacementFloorPoints[position] =
        floorSorted[replacementRanks[position] - 1]?.floorPoints ?? floorSorted.at(-1)?.floorPoints ?? 0;
      replacementCeilingPoints[position] =
        ceilingSorted[replacementRanks[position] - 1]?.ceilingPoints ?? ceilingSorted.at(-1)?.ceilingPoints ?? 0;
    });

    const projectionRanks = [...enhancedDraftPool].sort((a, b) => b.leagueAdjustedPoints - a.leagueAdjustedPoints);
    const projectionRankById = new Map(projectionRanks.map((player, index) => [player.id, index + 1]));
    const tiersByPlayerId = assignPlayerTiers(enhancedDraftPool);
    const positionBonus: Record<DraftablePosition, number> = { QB: 0.8, RB: 1.6, WR: 1.4, TE: 1 };

    const scoredPlayers = enhancedDraftPool
      .map((player) => {
        const projectionRank = projectionRankById.get(player.id) ?? projectionRanks.length + 1;
        const adp =
          typeof player.adp === 'number' && Number.isFinite(player.adp) && player.adp > 0
            ? player.adp
            : typeof player.ecr === 'number' && Number.isFinite(player.ecr) && player.ecr > 0
              ? player.ecr
              : projectionRank;
        const valueGap = adp - projectionRank;
        const vorp = player.leagueAdjustedPoints - replacementPoints[player.position];
        const floorVorp = player.floorPoints - replacementFloorPoints[player.position];
        const ceilingVorp = player.ceilingPoints - replacementCeilingPoints[player.position];
        const expectedGamesPlayed = getInjuryPenalty(player.advancedFields);
        const baseDraftScore =
          vorp * 3 + valueGap * 0.6 + player.leagueAdjustedPoints * 0.08 + positionBonus[player.position];
        const targetsPerRouteRun = getStatNumber(player.advancedFields, STAT_PATHS.targetsPerRouteRun) ?? 0;
        const yprr = getStatNumber(player.advancedFields, STAT_PATHS.yprr) ?? 0;
        const qualifiesForBreakoutCoefficient =
          (player.position === 'WR' || player.position === 'TE') && (targetsPerRouteRun > 0.25 || yprr > 2.0);
        const draftScore = baseDraftScore * (qualifiesForBreakoutCoefficient ? BREAKOUT_COEFFICIENT : 1);
        const rookieDraftScoreBoost = hasRookieUpsideProfile(player) ? ROOKIE_DRAFT_SCORE_BOOST : 0;

        return {
          ...player,
          draftScore: Number.parseFloat((draftScore + rookieDraftScoreBoost).toFixed(2)),
          vorp: Number.parseFloat(vorp.toFixed(2)),
          floorVorp: Number.parseFloat(floorVorp.toFixed(2)),
          ceilingVorp: Number.parseFloat(ceilingVorp.toFixed(2)),
          tier: tiersByPlayerId.get(player.id) ?? 1,
          valueGap: Number.parseFloat(valueGap.toFixed(2)),
          upsideProbability: player.upsideProbability,
          expectedGamesPlayed: Number.parseFloat(expectedGamesPlayed.toFixed(1)),
          expectedOverallPick: Number.parseFloat(adp.toFixed(1)),
        };
      })
      .sort((a, b) => b.draftScore - a.draftScore);

    console.log('[DashboardClient] draft score summary', {
      rosterSettings,
      replacementRanks,
      leagueScoring: LEAGUE_SCORING,
      replacementPoints,
      replacementFloorPoints,
      replacementCeilingPoints,
      detailedStatPlayers: enhancedDraftPool.filter((player) => player.usedDetailedStats).length,
      topPlayers: scoredPlayers.slice(0, 5).map((player) => ({
        name: player.name,
        position: player.position,
        draftScore: player.draftScore,
        tier: player.tier,
        vorp: player.vorp,
        floorVorp: player.floorVorp,
        ceilingVorp: player.ceilingVorp,
      })),
    });

    return scoredPlayers;
  }, [liveData, rosterSettings]);

  const draftBoard = useMemo<DraftBoardRow[]>(() => {
    const available = [...draftRankedPlayers];
    const roster = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const rosterByTeam = new Map<string, { QB: number; WR: number; TE: number }>();
    let rosterConstructionPath: 'neutral' | 'hero-rb' | 'zero-rb' = 'neutral';
    const rows: DraftBoardRow[] = [];

    for (let round = 1; round <= DRAFT_ROUNDS; round += 1) {
      const overallPick = calculateSnakePick(round, draftPosition, DRAFT_TEAM_COUNT);

      if (rosterConstructionPath === 'neutral') {
        if (round === 2 && roster.RB === 1) {
          rosterConstructionPath = 'hero-rb';
        } else if (round >= 3 && roster.RB === 0) {
          rosterConstructionPath = 'zero-rb';
        }
      }

      const isZeroRbWindow = rosterConstructionPath === 'zero-rb' && round >= 3 && round <= 6;
      const isHeroRbWindow = rosterConstructionPath === 'hero-rb' && round >= 2 && round <= 6;

      const pivotStrategy =
        isZeroRbWindow
          ? 'Pivot: Zero RB active (0 RB through Round 2), sharply de-prioritizing RB while boosting WR/elite TE.'
          : isHeroRbWindow
            ? 'Pivot: Hero RB active (1 RB secured), leaning WR/elite TE to optimize roster construction.'
            : null;
      const strategy = pivotStrategy ? `${getRoundStrategy(round, draftPosition)} ${pivotStrategy}` : getRoundStrategy(round, draftPosition);

      const rankedCandidates = available
        .map((player) => {
          const playerPosition = player.position as DraftablePosition;
          const team = player.team.trim().toUpperCase();
          const teamRoster = rosterByTeam.get(team);
          const completesStack =
            Boolean(teamRoster) &&
            ((player.position === 'QB' && ((teamRoster?.WR ?? 0) > 0 || (teamRoster?.TE ?? 0) > 0)) ||
              ((player.position === 'WR' || player.position === 'TE') && (teamRoster?.QB ?? 0) > 0));
          const correlationBoost = completesStack ? STACK_CORRELATION_BOOST : 0;

          const dynamicPriorityBoost =
            (player.position === 'WR' ? 0.9 : 0) +
            (player.position === 'RB' && roster.RB < 2 ? 0.8 : 0.15) +
            (player.position === 'TE' && round <= 6 ? 0.35 : 0) +
            (player.position === 'QB' && round <= 4 ? -0.65 : 0);

          const starterNeedBoost =
            (player.position === 'QB' && roster.QB === 0 && round >= 5 ? 3 : 0) +
            (player.position === 'TE' && roster.TE === 0 && round >= 6 ? 2.75 : 0) +
            (player.position === 'RB' && roster.RB < 2 ? 1.6 : 0) +
            (player.position === 'WR' && roster.WR < 2 ? 1.5 : 0);
          const isStartingPositionNeed = roster[playerPosition] < rosterSettings.starters[playerPosition];
          const remainingPlayersInTierAtPosition = available.filter(
            (availablePlayer) => availablePlayer.position === player.position && availablePlayer.tier === player.tier,
          ).length;
          const isLastRemainingInTier = remainingPlayersInTierAtPosition === 1;
          const tierDropWarningBoost =
            isStartingPositionNeed && isLastRemainingInTier ? TIER_DROP_WARNING_BOOST : 0;

          const rosterConstructionModifier =
            isZeroRbWindow
              ? player.position === 'RB'
                ? -8.5
                : player.position === 'WR'
                  ? 3.5
                  : isEliteTightEnd(player)
                    ? 4
                    : 0
              : isHeroRbWindow
                ? player.position === 'RB'
                  ? -2.75
                  : player.position === 'WR'
                    ? 1.75
                    : isEliteTightEnd(player)
                      ? 2.5
                      : 0
                : 0;

          const roundWeightedScore =
            round >= 8
              ? player.ceilingVorp
              : round <= 4
                ? player.floorVorp * 3 + player.vorp * 0.4 + dynamicPriorityBoost * 0.2 + starterNeedBoost * 0.2
                : player.draftScore + dynamicPriorityBoost + starterNeedBoost;

          const ceilingModeScore =
            player.ceilingPoints * 1.4 +
            player.upsideProbability * 1.8 +
            player.ceilingVorp * 2 +
            dynamicPriorityBoost * 0.4 +
            starterNeedBoost * 0.25;

          // Avoid drafting players multiple rounds before ADP indicates they are likely available.
          const twoRoundBufferPicks = DRAFT_TEAM_COUNT * 2;
          const adpDelayPicks = player.expectedOverallPick - overallPick;
          const heavyReachPenalty =
            round <= 6 && adpDelayPicks >= twoRoundBufferPicks ? Math.min(18, adpDelayPicks * 0.35) : 0;

          return {
            player,
            score:
              (draftMode === 'matchup-winning-ceiling' ? ceilingModeScore : roundWeightedScore) -
              heavyReachPenalty +
              correlationBoost +
              rosterConstructionModifier +
              tierDropWarningBoost,
            receivedStackBoost: completesStack,
          };
        })
        .sort((a, b) => b.score - a.score);

      const likelyPick = [...available]
        .filter((player) => player.expectedOverallPick >= overallPick)
        .sort((a, b) => b.draftScore - a.draftScore)[0] ?? [...available].sort((a, b) => b.draftScore - a.draftScore)[0] ?? null;

      const primaryCandidate = rankedCandidates[0];
      const primary = primaryCandidate?.player ?? null;
      const primaryHasStack = Boolean(primaryCandidate?.receivedStackBoost);
      const alternatives = rankedCandidates.slice(1, 3).map((candidate) => candidate.player);

      if (primary) {
        const removeIndex = available.findIndex((player) => player.id === primary.id);
        if (removeIndex >= 0) {
          available.splice(removeIndex, 1);
        }

        if (isDraftablePosition(primary.position)) {
          roster[primary.position] += 1;
        }

        if (isStackablePosition(primary.position)) {
          const team = primary.team.trim().toUpperCase();
          const currentTeamRoster = rosterByTeam.get(team) ?? { QB: 0, WR: 0, TE: 0 };
          currentTeamRoster[primary.position] += 1;
          rosterByTeam.set(team, currentTeamRoster);
        }
      }

      rows.push({
        round,
        overallPick,
        strategy,
        primary,
        primaryHasStack,
        likelyPick,
        alternatives,
      });
    }

    console.log('[DashboardClient] draft board generated', {
      draftPosition,
      slotBucket: getDraftSlotBucket(draftPosition),
      rounds: rows.length,
      firstRoundRecommendation: rows[0]?.primary?.name ?? null,
    });

    return rows;
  }, [draftMode, draftPosition, draftRankedPlayers, rosterSettings]);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-testid="dashboard-client-root"
    >
      <div
        className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:flex-row"
        data-testid="dashboard-controls"
      >
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => {
              console.log('[DashboardClient] search updated', { value: e.target.value });
              setSearch(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="player-search-input"
          />
        </div>

        <div className="flex w-full gap-2 overflow-x-auto pb-2 sm:w-auto sm:pb-0">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => {
                console.log('[DashboardClient] position filter updated', { position: pos });
                setPositionFilter(pos);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                positionFilter === pos
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
              data-testid={`position-filter-${pos.toLowerCase()}`}
            >
              {pos}
            </button>
          ))}
        </div>

        <div className="flex w-full flex-col items-start gap-1 sm:w-auto sm:items-end">
          <button
            type="button"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isRefreshing
                ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
            data-testid="refresh-data-button"
          >
            {isRefreshing ? 'Refreshing FP Data...' : 'Refresh FP Data'}
          </button>
          {lastRefreshLabel ? (
            <p className="text-xs text-slate-500" data-testid="refresh-last-updated">
              Last updated: {lastRefreshLabel}
            </p>
          ) : null}
          {refreshError ? (
            <p className="text-xs text-red-600" data-testid="refresh-error-message">
              {refreshError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-b border-slate-100 bg-white px-4 py-3" data-testid="dashboard-tabs">
        <div className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'player-rankings'}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'player-rankings'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-player-rankings"
            onClick={() => {
              console.log('[DashboardClient] tab changed', { activeTab: 'player-rankings' });
              setActiveTab('player-rankings');
            }}
          >
            Player Rankings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'draft-board'}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'draft-board'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-draft-board"
            onClick={() => {
              console.log('[DashboardClient] tab changed', { activeTab: 'draft-board' });
              setActiveTab('draft-board');
            }}
          >
            12-Team Draft Board
          </button>
        </div>
      </div>

      {activeTab === 'draft-board' ? (
        <section className="m-4 rounded-lg border border-slate-200 bg-slate-50 p-4" data-testid="draft-board-root">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">12-Team Draft Board</h2>
              <p className="text-xs text-slate-500">
                Pick-by-pick recommendations optimized for your draft slot using value, scarcity tiers, and timing windows.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700" htmlFor="draft-position-select">
              Draft Position
              <select
                id="draft-position-select"
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                value={draftPosition}
                data-testid="draft-position-select"
                onChange={(event) => {
                  const nextDraftPosition = Number.parseInt(event.target.value, 10);
                  console.log('[DashboardClient] draft position updated', { draftPosition: nextDraftPosition });
                  setDraftPosition(nextDraftPosition);
                }}
              >
                {DRAFT_POSITIONS.map((slot) => (
                  <option key={slot} value={slot}>
                    Pick {slot}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-700" data-testid="draft-mode-toggle">
              <button
                type="button"
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  draftMode === 'safe-floor'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                }`}
                data-testid="draft-mode-safe-floor"
                onClick={() => setDraftMode('safe-floor')}
              >
                Safe Floor
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  draftMode === 'matchup-winning-ceiling'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                }`}
                data-testid="draft-mode-matchup-winning-ceiling"
                onClick={() => setDraftMode('matchup-winning-ceiling')}
              >
                Matchup-Winning Ceiling
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700" data-testid="draft-board-table">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-2 py-2">Round</th>
                  <th className="px-2 py-2">Overall Pick</th>
                  <th className="px-2 py-2">Strategy</th>
                  <th className="px-2 py-2">Primary Target</th>
                  <th className="px-2 py-2">Likely Pick</th>
                  <th className="px-2 py-2">Alternatives</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {draftBoard.map((row) => (
                  <tr key={row.round} data-testid={`draft-board-row-${row.round}`}>
                    <td className="px-2 py-2 font-semibold text-slate-900">{row.round}</td>
                    <td className="px-2 py-2 font-mono" data-testid={`draft-board-pick-${row.round}`}>
                      {row.overallPick}
                    </td>
                    <td className="px-2 py-2">{row.strategy}</td>
                    <td className="px-2 py-2" data-testid={`draft-board-primary-${row.round}`}>
                      {row.primary ? (
                        <div className="flex items-center gap-2">
                          <span>{`${row.primary.name} (${row.primary.position})`}</span>
                          {row.primaryHasStack ? (
                            <span
                              className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800"
                              data-testid={`draft-board-stack-badge-${row.round}`}
                            >
                              Stack
                            </span>
                          ) : null}
                          {hasRookieUpsideProfile(row.primary) ? (
                            <span
                              className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800"
                              data-testid={`draft-board-rookie-badge-${row.round}`}
                            >
                              Rookie Upside
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        'No candidate available'
                      )}
                    </td>
                    <td className="px-2 py-2" data-testid={`draft-board-likely-${row.round}`}>
                      {row.likelyPick ? `${row.likelyPick.name} (${row.likelyPick.position})` : 'No likely pick available'}
                    </td>
                    <td className="px-2 py-2 text-slate-500">
                      {row.alternatives.length > 0
                        ? row.alternatives.map((player) => `${player.name} (${player.position})`).join(', ')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'player-rankings' ? (
        <>
      <div className="border-b border-slate-100 bg-white p-4" data-testid="advanced-columns-panel">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          data-testid="advanced-columns-toggle"
          onClick={() => {
            const nextValue = !showAdvancedColumns;
            console.log('[DashboardClient] advanced columns panel toggled', {
              showAdvancedColumns: nextValue,
              availableColumns: advancedColumnOptions.length,
            });
            setShowAdvancedColumns(nextValue);
          }}
        >
          Advanced Columns ({selectedAdvancedColumns.length})
        </button>

        {showAdvancedColumns ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3" data-testid="advanced-columns-options">
            {advancedColumnOptions.length > 0 ? (
              advancedColumnOptions.map((option) => (
                <label
                  key={option.path}
                  htmlFor={`advanced-column-${option.path}`}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                >
                  <input
                    id={`advanced-column-${option.path}`}
                    type="checkbox"
                    checked={selectedAdvancedColumns.includes(option.path)}
                    onChange={() => handleAdvancedColumnToggle(option.path)}
                  />
                  <span>{option.path}</span>
                  <span className="ml-auto text-slate-400">{option.valueCount}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-slate-500">No additional merged fields available for this dataset.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600" data-testid="players-table">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
            <tr>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('name')}
                data-testid="sort-name"
              >
                Player {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('team')}
                data-testid="sort-team"
              >
                Team {sortConfig?.key === 'team' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('position')}
                data-testid="sort-position"
              >
                Position {sortConfig?.key === 'position' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('ecr')}
                data-testid="sort-ecr"
              >
                Consensus Rank (ECR) {sortConfig?.key === 'ecr' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('proj_pts')}
                data-testid="sort-proj-pts"
              >
                Projected Points {sortConfig?.key === 'proj_pts' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              {selectedAdvancedColumns.map((path) => {
                const sortKey = `advanced:${path}` as SortKey;
                const sanitized = sanitizePathForTestId(path);
                return (
                  <th
                    key={path}
                    className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                    data-testid={`advanced-header-${sanitized}`}
                    onClick={() => handleSort(sortKey)}
                  >
                    {path} {sortConfig?.key === sortKey && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((player) => (
                <tr key={player.id} className="transition-colors hover:bg-slate-50" data-testid={`player-row-${player.id}`}>
                  <td className="px-6 py-4 font-semibold text-slate-900">{player.name}</td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold tracking-wide text-slate-700">
                      {player.team}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        player.position === 'RB'
                          ? 'bg-green-100 text-green-700'
                          : player.position === 'WR'
                            ? 'bg-blue-100 text-blue-700'
                            : player.position === 'QB'
                              ? 'bg-red-100 text-red-700'
                              : player.position === 'TE'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {player.position}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono">{player.ecr ?? '-'}</td>
                  <td className="px-6 py-4 font-mono font-semibold text-indigo-600">
                    {typeof player.proj_pts === 'number' ? player.proj_pts.toFixed(1) : '-'}
                  </td>
                  {selectedAdvancedColumns.map((path) => {
                    const displayValue = formatAdvancedValue(getValueAtPath(player.advancedFields, path));
                    return (
                      <td
                        key={`${player.id}-${path}`}
                        className="px-6 py-4 font-mono text-xs"
                        data-testid={`advanced-cell-${player.id}-${sanitizePathForTestId(path)}`}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5 + selectedAdvancedColumns.length}
                  className="px-6 py-12 text-center text-slate-500"
                  data-testid="dashboard-empty-state"
                >
                  No players found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      ) : null}
    </div>
  );
}

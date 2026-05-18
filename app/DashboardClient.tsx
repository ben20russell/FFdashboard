'use client';

import React, { useMemo, useState } from 'react';

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
  ecr?: number;
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
type DraftScoredPlayer = Player & {
  draftScore: number;
  vorp: number;
  valueGap: number;
  injuryPenalty: number;
  expectedOverallPick: number;
};
type DraftTab = 'player-rankings' | 'draft-board';
type DraftBoardRow = {
  round: number;
  overallPick: number;
  strategy: string;
  primary: DraftScoredPlayer | null;
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

const DRAFT_TEAM_COUNT = 12;
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
} as const;

function isDraftablePosition(position: string): position is DraftablePosition {
  return position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE';
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

  if (round <= 4) return 'Exploit elite TE window + target-share WR tiers';
  if (round <= 6) return 'RB/WR value core; prioritize rushing-QB value lane';
  if (round <= 9) return 'Attack WR breakout pocket and RB handcuff leverage';
  return 'Upside bench build; delay DST and streamable positions';
}

function getRoundPositionPriority(round: number, draftPosition: number): DraftablePosition[] {
  const slotBucket = getDraftSlotBucket(draftPosition);

  if (round === 1) {
    if (slotBucket === 'late') return ['WR', 'RB', 'TE', 'QB'];
    return ['RB', 'WR', 'TE', 'QB'];
  }

  if (round === 2) {
    if (slotBucket === 'early') return ['WR', 'RB', 'TE', 'QB'];
    if (slotBucket === 'middle') return ['RB', 'WR', 'TE', 'QB'];
    return ['WR', 'TE', 'RB', 'QB'];
  }

  if (round === 3) {
    if (slotBucket === 'early') return ['TE', 'WR', 'RB', 'QB'];
    if (slotBucket === 'middle') return ['WR', 'RB', 'TE', 'QB'];
    return ['TE', 'RB', 'WR', 'QB'];
  }

  if (round === 4) return ['WR', 'TE', 'RB', 'QB'];
  if (round === 5) return ['WR', 'RB', 'QB', 'TE'];
  if (round === 6) return ['QB', 'WR', 'RB', 'TE'];
  if (round === 7) return ['WR', 'RB', 'QB', 'TE'];
  if (round === 8) return ['WR', 'QB', 'RB', 'TE'];
  if (round === 9) return ['WR', 'RB', 'QB', 'TE'];
  return ['RB', 'WR', 'TE', 'QB'];
}

function getInjuryPenalty(advancedFields: Record<string, unknown> | undefined): number {
  const injuryText = String(
    advancedFields?.injuryStatus ?? advancedFields?.injury_status ?? advancedFields?.status ?? '',
  ).toLowerCase();

  if (!injuryText || injuryText === 'null' || injuryText === 'none' || injuryText === 'healthy') {
    return 0;
  }

  if (injuryText.includes('questionable')) return 1.25;
  if (injuryText.includes('doubtful')) return 2;
  if (injuryText.includes('out')) return 3;
  return 0.75;
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

function getValueAtPath(source: Record<string, unknown> | undefined, path: string): unknown {
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
    const value = getValueAtPath(source, path);
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

export function computeLeagueAdjustedProjection(player: Player): { points: number; usedDetailedStats: boolean } {
  const baseProjection = typeof player.proj_pts === 'number' ? player.proj_pts : 0;
  const source = player.advancedFields;

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

  if (hasDetailedStats) {
    let points = 0;
    points += (passYards ?? 0) / LEAGUE_SCORING.passingYardsPerPoint;
    points += (passTd ?? 0) * LEAGUE_SCORING.passingTd;
    points += (passInterceptions ?? 0) * LEAGUE_SCORING.passInterception;
    points += (pickSixThrown ?? 0) * LEAGUE_SCORING.pickSixThrown;
    points += (rushYards ?? 0) / LEAGUE_SCORING.rushingYardsPerPoint;
    points += (rushTd ?? 0) * LEAGUE_SCORING.rushingTd;
    points += (recYards ?? 0) / LEAGUE_SCORING.receivingYardsPerPoint;
    points += (recTd ?? 0) * LEAGUE_SCORING.receivingTd;
    points += (twoPoint ?? 0) * LEAGUE_SCORING.twoPointConversion;
    points += (fumblesLost ?? 0) * LEAGUE_SCORING.fumbleLost;

    if ((passYards ?? 0) >= 400) {
      points += LEAGUE_SCORING.passingBonus400;
    } else if ((passYards ?? 0) >= 300) {
      points += LEAGUE_SCORING.passingBonus300;
    }

    if ((rushYards ?? 0) >= 200) {
      points += LEAGUE_SCORING.rushingBonus200;
    } else if ((rushYards ?? 0) >= 100) {
      points += LEAGUE_SCORING.rushingBonus100;
    }

    if ((recYards ?? 0) >= 200) {
      points += LEAGUE_SCORING.receivingBonus200;
    } else if ((recYards ?? 0) >= 100) {
      points += LEAGUE_SCORING.receivingBonus100;
    }

    return {
      points: Number.parseFloat(Math.max(0, points).toFixed(2)),
      usedDetailedStats: true,
    };
  }

  const fallbackMultiplierMap: Record<DraftablePosition, number> = {
    QB: 1.07,
    RB: 1.04,
    WR: 0.98,
    TE: 0.95,
  };

  const position = isDraftablePosition(player.position) ? player.position : 'WR';
  return {
    points: Number.parseFloat((baseProjection * fallbackMultiplierMap[position]).toFixed(2)),
    usedDetailedStats: false,
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
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);
  const [selectedAdvancedColumns, setSelectedAdvancedColumns] = useState<string[]>([]);
  const [draftPosition, setDraftPosition] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<DraftTab>('player-rankings');

  const advancedColumnOptions = useMemo<AdvancedColumnOption[]>(() => {
    const pathSet = new Set<string>();

    for (const player of initialData) {
      flattenFieldPaths(player.advancedFields, '', pathSet);
    }

    const paths = Array.from(pathSet).sort((a, b) => a.localeCompare(b));
    return paths.map((path) => ({
      path,
      valueCount: initialData.filter((player) => getValueAtPath(player.advancedFields, path) !== undefined).length,
    }));
  }, [initialData]);

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
      initialCount: initialData.length,
      search,
      positionFilter,
      sortKey: sortConfig?.key ?? null,
      sortDirection: sortConfig?.direction ?? null,
    });

    let filtered = [...initialData];

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
  }, [initialData, search, positionFilter, sortConfig]);

  const draftRankedPlayers = useMemo<DraftScoredPlayer[]>(() => {
    const draftPool = initialData.filter(
      (player) => isDraftablePosition(player.position) && typeof player.proj_pts === 'number',
    ) as Array<Player & { position: DraftablePosition; proj_pts: number }>;

    console.log('[DashboardClient] building draft player scores', {
      initialPlayerCount: initialData.length,
      draftablePlayerCount: draftPool.length,
    });

    if (draftPool.length === 0) {
      return [];
    }

    const enhancedDraftPool = draftPool.map((player) => {
      const leagueAdjusted = computeLeagueAdjustedProjection(player);
      return {
        ...player,
        leagueAdjustedPoints: leagueAdjusted.points,
        usedDetailedStats: leagueAdjusted.usedDetailedStats,
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

    const replacementRanks: Record<DraftablePosition, number> = {
      QB: 12,
      RB: 30,
      WR: 36,
      TE: 12,
    };

    const replacementPoints: Record<DraftablePosition, number> = {
      QB: byPosition.QB[replacementRanks.QB - 1]?.leagueAdjustedPoints ?? byPosition.QB.at(-1)?.leagueAdjustedPoints ?? 0,
      RB: byPosition.RB[replacementRanks.RB - 1]?.leagueAdjustedPoints ?? byPosition.RB.at(-1)?.leagueAdjustedPoints ?? 0,
      WR: byPosition.WR[replacementRanks.WR - 1]?.leagueAdjustedPoints ?? byPosition.WR.at(-1)?.leagueAdjustedPoints ?? 0,
      TE: byPosition.TE[replacementRanks.TE - 1]?.leagueAdjustedPoints ?? byPosition.TE.at(-1)?.leagueAdjustedPoints ?? 0,
    };

    const projectionRanks = [...enhancedDraftPool].sort((a, b) => b.leagueAdjustedPoints - a.leagueAdjustedPoints);
    const projectionRankById = new Map(projectionRanks.map((player, index) => [player.id, index + 1]));
    const positionBonus: Record<DraftablePosition, number> = { QB: 0.8, RB: 1.6, WR: 1.4, TE: 1 };

    const scoredPlayers = enhancedDraftPool
      .map((player) => {
        const projectionRank = projectionRankById.get(player.id) ?? projectionRanks.length + 1;
        const ecr = typeof player.ecr === 'number' && Number.isFinite(player.ecr) && player.ecr > 0 ? player.ecr : projectionRank;
        const valueGap = ecr - projectionRank;
        const vorp = player.leagueAdjustedPoints - replacementPoints[player.position];
        const injuryPenalty = getInjuryPenalty(player.advancedFields);
        const draftScore =
          vorp * 3 + valueGap * 0.6 + player.leagueAdjustedPoints * 0.08 + positionBonus[player.position] - injuryPenalty;

        return {
          ...player,
          draftScore: Number.parseFloat(draftScore.toFixed(2)),
          vorp: Number.parseFloat(vorp.toFixed(2)),
          valueGap: Number.parseFloat(valueGap.toFixed(2)),
          injuryPenalty: Number.parseFloat(injuryPenalty.toFixed(2)),
          expectedOverallPick: Number.parseFloat(ecr.toFixed(1)),
        };
      })
      .sort((a, b) => b.draftScore - a.draftScore);

    console.log('[DashboardClient] draft score summary', {
      leagueScoring: LEAGUE_SCORING,
      replacementPoints,
      detailedStatPlayers: enhancedDraftPool.filter((player) => player.usedDetailedStats).length,
      topPlayers: scoredPlayers.slice(0, 5).map((player) => ({
        name: player.name,
        position: player.position,
        draftScore: player.draftScore,
        vorp: player.vorp,
      })),
    });

    return scoredPlayers;
  }, [initialData]);

  const draftBoard = useMemo<DraftBoardRow[]>(() => {
    const available = [...draftRankedPlayers];
    const roster = { QB: 0, RB: 0, WR: 0, TE: 0 };
    const rows: DraftBoardRow[] = [];

    for (let round = 1; round <= DRAFT_ROUNDS; round += 1) {
      const priority = getRoundPositionPriority(round, draftPosition);
      const overallPick = calculateSnakePick(round, draftPosition, DRAFT_TEAM_COUNT);

      const rankedCandidates = available
        .map((player) => {
          const priorityIndex = priority.indexOf(player.position as DraftablePosition);
          const priorityBoost = priorityIndex >= 0 ? (priority.length - priorityIndex) * 0.4 : -0.5;
          const starterNeedBoost =
            (player.position === 'QB' && roster.QB === 0 && round >= 5 ? 3 : 0) +
            (player.position === 'TE' && roster.TE === 0 && round >= 6 ? 2.75 : 0) +
            (player.position === 'RB' && roster.RB < 2 ? 1.6 : 0) +
            (player.position === 'WR' && roster.WR < 2 ? 1.5 : 0);

          return {
            player,
            score: player.draftScore + priorityBoost + starterNeedBoost,
          };
        })
        .sort((a, b) => b.score - a.score);

      const likelyPick = [...available]
        .filter((player) => player.expectedOverallPick >= overallPick)
        .sort((a, b) => b.draftScore - a.draftScore)[0] ?? [...available].sort((a, b) => b.draftScore - a.draftScore)[0] ?? null;

      const primary = rankedCandidates[0]?.player ?? null;
      const alternatives = rankedCandidates.slice(1, 3).map((candidate) => candidate.player);

      if (primary) {
        const removeIndex = available.findIndex((player) => player.id === primary.id);
        if (removeIndex >= 0) {
          available.splice(removeIndex, 1);
        }

        if (isDraftablePosition(primary.position)) {
          roster[primary.position] += 1;
        }
      }

      rows.push({
        round,
        overallPick,
        strategy: getRoundStrategy(round, draftPosition),
        primary,
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
  }, [draftPosition, draftRankedPlayers]);

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
                      {row.primary ? `${row.primary.name} (${row.primary.position})` : 'No candidate available'}
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

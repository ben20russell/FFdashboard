import type { PlayerInput } from '@/types/player';

export type PlayerValueProjection = {
  median: number;
  floor: number;
  ceiling: number;
};

export type TeamProjectionBaseline = {
  passingYards: number;
  rushingYards: number;
};

export const DEFAULT_TEAM_PROJECTION_BASELINE: TeamProjectionBaseline = {
  passingYards: 3950,
  rushingYards: 1900,
};

// Mock top-down team volume assumptions to constrain player-level projection overshoot.
export const TEAM_PROJECTIONS: Record<string, TeamProjectionBaseline> = {
  ARI: { passingYards: 3700, rushingYards: 2150 },
  ATL: { passingYards: 3500, rushingYards: 2250 },
  BAL: { passingYards: 3600, rushingYards: 2350 },
  BUF: { passingYards: 4100, rushingYards: 2050 },
  CAR: { passingYards: 3450, rushingYards: 2050 },
  CHI: { passingYards: 3600, rushingYards: 2200 },
  CIN: { passingYards: 4400, rushingYards: 1750 },
  CLE: { passingYards: 3500, rushingYards: 2050 },
  DAL: { passingYards: 4300, rushingYards: 1750 },
  DEN: { passingYards: 3600, rushingYards: 1950 },
  DET: { passingYards: 4200, rushingYards: 1950 },
  GB: { passingYards: 4000, rushingYards: 2000 },
  HOU: { passingYards: 4050, rushingYards: 1900 },
  IND: { passingYards: 3500, rushingYards: 2300 },
  JAX: { passingYards: 3800, rushingYards: 1900 },
  KC: { passingYards: 4450, rushingYards: 1650 },
  LAC: { passingYards: 4100, rushingYards: 1800 },
  LAR: { passingYards: 4100, rushingYards: 1750 },
  LV: { passingYards: 3600, rushingYards: 1850 },
  MIA: { passingYards: 4300, rushingYards: 1850 },
  MIN: { passingYards: 4300, rushingYards: 1700 },
  NE: { passingYards: 3350, rushingYards: 1950 },
  NO: { passingYards: 3650, rushingYards: 1850 },
  NYG: { passingYards: 3400, rushingYards: 2050 },
  NYJ: { passingYards: 3500, rushingYards: 1900 },
  PHI: { passingYards: 3850, rushingYards: 2350 },
  PIT: { passingYards: 3450, rushingYards: 2050 },
  SEA: { passingYards: 3900, rushingYards: 1950 },
  SF: { passingYards: 3900, rushingYards: 2200 },
  TB: { passingYards: 4250, rushingYards: 1600 },
  TEN: { passingYards: 3300, rushingYards: 2150 },
  WAS: { passingYards: 3550, rushingYards: 2000 },
};

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

export function normalizeTeamAbbreviation(teamInput: unknown): string | null {
  if (typeof teamInput !== 'string') {
    return null;
  }

  const normalized = teamInput.trim().toUpperCase();
  return normalized ? normalized : null;
}

export function getTeamProjectionBaseline(team: string | null): TeamProjectionBaseline {
  if (!team) {
    return DEFAULT_TEAM_PROJECTION_BASELINE;
  }

  return TEAM_PROJECTIONS[team] ?? DEFAULT_TEAM_PROJECTION_BASELINE;
}

export function isPassCatcherPosition(positionInput: unknown): boolean {
  if (typeof positionInput !== 'string') {
    return false;
  }

  const position = positionInput.trim().toUpperCase();
  return position === 'WR' || position === 'TE' || position === 'RB';
}

export function getProjectedReceivingYards(playerData: Partial<PlayerInput>): number {
  const direct = parseFloatSafe(
    playerData.rec_yds ??
      playerData.receiving_yds ??
      playerData.receiving_yards ??
      playerData.projected_receiving_yards,
  );
  if (direct > 0) {
    return direct;
  }

  if (Array.isArray(playerData.stats) && playerData.stats.length > 0) {
    const firstStat = playerData.stats[0];
    if (firstStat && typeof firstStat === "object") {
      const statRecord = firstStat as Record<string, unknown>;
      const nested = parseFloatSafe(statRecord.rec_yds ?? statRecord.receiving_yds ?? statRecord.receiving_yards);
      if (nested > 0) {
        return nested;
      }
    }
  }

  return 0;
}

/**
 * Calculates a placeholder value score for a fantasy football player.
 *
 * Where to customize later:
 * - Replace projectedPoints weighting with your own projection model output.
 * - Add schedule strength, injury signals, pace/play-volume, and opponent adjustments.
 * - Add league-specific factors (PPR/half-PPR/standard, superflex, roster settings).
 * - Add replacement-level baselines to move from raw points to true surplus value.
 *
 * Why this is mocked:
 * - We intentionally keep this simple and deterministic so UI/testing remains stable.
 * - This is not intended to be predictive production math yet; it is a clear insertion point.
 */
export function calculatePlayerValue(playerData: Partial<PlayerInput>): PlayerValueProjection {
  const resolvedName =
    (typeof playerData.name === 'string' && playerData.name) ||
    (typeof playerData.player_name === 'string' && playerData.player_name) ||
    (typeof playerData.full_name === 'string' && playerData.full_name) ||
    'Unknown Player';

  const rawProjectedPoints =
    typeof playerData.projected_points === 'number'
      ? playerData.projected_points
      : typeof playerData.projected_points === 'string'
        ? Number.parseFloat(playerData.projected_points)
        : typeof playerData.projectedPoints === 'number'
          ? playerData.projectedPoints
          : typeof playerData.projectedPoints === 'string'
            ? Number.parseFloat(playerData.projectedPoints)
        : typeof playerData.points === 'number'
          ? playerData.points
          : typeof playerData.points === 'string'
            ? Number.parseFloat(playerData.points)
            : 0;

  const median = Number.isFinite(rawProjectedPoints) ? rawProjectedPoints : 0;
  const position = typeof playerData.position === 'string' ? playerData.position.toUpperCase() : 'FLEX';

  const historicalPositionStdDev: Record<string, number> = {
    QB: 4.5,
    RB: 5.8,
    WR: 6.2,
    TE: 5,
    K: 3.2,
    DST: 4,
    FLEX: 5.6,
  };

  const positionStdDev = historicalPositionStdDev[position] ?? historicalPositionStdDev.FLEX;
  const floor = Math.max(0, median - positionStdDev);
  const ceiling = median + positionStdDev;
  const projectionBand: PlayerValueProjection = {
    median: Number.parseFloat(median.toFixed(2)),
    floor: Number.parseFloat(floor.toFixed(2)),
    ceiling: Number.parseFloat(ceiling.toFixed(2)),
  };

  console.log('[calculatePlayerValue] Inputs and computed score', {
    resolvedName,
    position,
    projectedPoints: median,
    positionStdDev,
    projectionBand,
  });

  return projectionBand;
}

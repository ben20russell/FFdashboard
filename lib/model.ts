import type { PlayerInput } from '@/types/player';

function hashStringToUnitInterval(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return (Math.abs(hash) % 1000) / 1000;
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
export function calculatePlayerValue(playerData: Partial<PlayerInput>): number {
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
        : typeof playerData.points === 'number'
          ? playerData.points
          : typeof playerData.points === 'string'
            ? Number.parseFloat(playerData.points)
            : 0;

  const projectedPoints = Number.isFinite(rawProjectedPoints) ? rawProjectedPoints : 0;
  const position = typeof playerData.position === 'string' ? playerData.position.toUpperCase() : 'FLEX';

  const positionWeightMap: Record<string, number> = {
    QB: 0.95,
    RB: 1.08,
    WR: 1.06,
    TE: 1.02,
    K: 0.82,
    DST: 0.88,
    FLEX: 1,
  };

  const positionWeight = positionWeightMap[position] ?? 1;
  const deterministicNoise = hashStringToUnitInterval(`${resolvedName}-${position}`) * 4;

  const weightedScore = projectedPoints * 3.4 * positionWeight + deterministicNoise;
  const finalScore = Number.parseFloat(weightedScore.toFixed(2));

  console.log('[calculatePlayerValue] Inputs and computed score', {
    resolvedName,
    position,
    projectedPoints,
    positionWeight,
    deterministicNoise,
    finalScore,
  });

  return finalScore;
}

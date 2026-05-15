import { calculatePlayerValue } from '@/lib/model';
import { getFantasyProsPlayers as getFantasyProsPlayersFromApi } from '@/lib/fantasypros-client';
import type { DashboardPlayer, PlayerInput } from '@/types/player';

function parseProjectedPoints(player: PlayerInput): number {
  const rawValue =
    typeof player.projected_points === 'number'
      ? player.projected_points
      : typeof player.projected_points === 'string'
        ? Number.parseFloat(player.projected_points)
        : typeof player.points === 'number'
          ? player.points
          : typeof player.points === 'string'
            ? Number.parseFloat(player.points)
            : 0;

  return Number.isFinite(rawValue) ? rawValue : 0;
}

function normalizePlayer(player: PlayerInput, index: number): DashboardPlayer {
  const name =
    (typeof player.name === 'string' && player.name) ||
    (typeof player.player_name === 'string' && player.player_name) ||
    (typeof player.full_name === 'string' && player.full_name) ||
    `Player ${index + 1}`;

  const position = typeof player.position === 'string' ? player.position.toUpperCase() : 'N/A';
  const projectedPoints = parseProjectedPoints(player);

  return {
    id: String(player.id ?? `${name}-${index}`),
    name,
    position,
    projectedPoints,
    customValueScore: calculatePlayerValue(player),
    raw: player,
  };
}

export type FantasyProsResult = {
  players: DashboardPlayer[];
  rawPayload: unknown;
  fetchedAtIso: string;
  errorMessage: string | null;
};

export async function getFantasyProsPlayers(): Promise<FantasyProsResult> {
  const playersResult = await getFantasyProsPlayersFromApi();
  const players = playersResult.items.map((player, index) => normalizePlayer(player, index));

  console.log('[getFantasyProsPlayers] Dashboard player normalization complete', {
    sourceEndpoint: playersResult.endpoint,
    rawPlayersCount: playersResult.items.length,
    normalizedPlayersCount: players.length,
    hadError: Boolean(playersResult.errorMessage),
  });

  return {
    players,
    rawPayload: playersResult.rawPayload,
    fetchedAtIso: playersResult.fetchedAtIso,
    errorMessage: playersResult.errorMessage,
  };
}

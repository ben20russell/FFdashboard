import { NextResponse } from 'next/server';
import { getFantasyProsPlayers } from '@/lib/fantasypros';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function extractTeamFromRaw(raw: Record<string, unknown>): string {
  const teamCandidate =
    (typeof raw.team === 'string' && raw.team) ||
    (typeof raw.team_abbr === 'string' && raw.team_abbr) ||
    (typeof raw.team_id === 'string' && raw.team_id) ||
    (typeof raw.teamAbbr === 'string' && raw.teamAbbr) ||
    (typeof raw.Team === 'string' && raw.Team) ||
    '';

  return teamCandidate || 'N/A';
}

export async function GET() {
  const result = await getFantasyProsPlayers({ forceRefresh: true });
  const players = result.players.map((player) => ({
    id: player.id,
    name: player.name,
    team: extractTeamFromRaw(player.raw),
    position: player.position,
    isRookie: player.isRookie,
    ecr: player.overallRank ?? undefined,
    adp: player.adp ?? undefined,
    proj_pts: player.projectedPoints,
    earlySeasonPoints: player.earlySeasonPoints ?? undefined,
    byeWeek: player.byeWeek ?? undefined,
    stdDev: player.stdDev ?? undefined,
    best: player.best ?? undefined,
    worst: player.worst ?? undefined,
    advancedFields: {
      ...player.raw,
      isRookie: player.isRookie,
      overallRank: player.overallRank,
      adp: player.adp,
      earlySeasonPoints: player.earlySeasonPoints,
      early_season_points: player.earlySeasonPoints,
      bye_week: player.byeWeek,
      byeWeek: player.byeWeek,
      std_dev: player.stdDev,
      volatility: player.stdDev,
      best: player.best,
      worst: player.worst,
      projectedPoints: player.projectedPoints,
      customValueScore: player.customValueScore,
      injuryStatus: player.injuryStatus,
    },
  }));

  return NextResponse.json({
    players,
    fetchedAtIso: result.fetchedAtIso,
    errorMessage: result.errorMessage,
  });
}

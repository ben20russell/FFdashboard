import React from 'react';
import Image from 'next/image';
import DashboardClient from './DashboardClient';
import { DashboardErrorBoundary } from '@/components/DashboardErrorBoundary';
import { getFantasyProsPlayers } from '@/lib/fantasypros';

type DashboardTablePlayer = {
  id: string;
  name: string;
  team: string;
  position: string;
  isRookie: boolean;
  ecr?: number;
  adp?: number;
  proj_pts?: number;
  earlySeasonPoints?: number;
  byeWeek?: number;
  stdDev?: number;
  best?: number;
  worst?: number;
  advancedFields: Record<string, unknown>;
};

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

function mapToDashboardTablePlayers(players: Awaited<ReturnType<typeof getFantasyProsPlayers>>['players']): DashboardTablePlayer[] {
  return players.map((player) => ({
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
}

export default async function Page() {
  console.log('[Page] Fetching full merged FantasyPros model from server');

  const result = await getFantasyProsPlayers();
  const players = mapToDashboardTablePlayers(result.players);

  console.log('[Page] Rendering dashboard from full model', {
    playersCount: players.length,
    hadError: Boolean(result.errorMessage),
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 md:p-12" data-testid="dashboard-page">
      <div className="mx-auto max-w-7xl" data-testid="dashboard-container">
        <header className="mb-8" data-testid="dashboard-header">
          <div className="mb-2 flex items-center gap-3">
            <Image
              src="/football.svg"
              alt="Football logo"
              width={36}
              height={36}
              priority
              data-testid="dashboard-logo"
            />
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">NFL Fantasy Intelligence</h1>
          </div>
          <p className="text-lg text-slate-500">
            Full-model view combining players, rankings, projections, and injuries.
          </p>
          {result.errorMessage ? (
            <p className="mt-2 text-sm text-red-600" data-testid="dashboard-warning">
              Some FantasyPros sources failed: {result.errorMessage}
            </p>
          ) : null}
        </header>

        <DashboardErrorBoundary>
          <DashboardClient initialData={players} />
        </DashboardErrorBoundary>
      </div>
    </main>
  );
}

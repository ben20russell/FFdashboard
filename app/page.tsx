import DashboardClient from './DashboardClient';
import { DashboardErrorBoundary } from '@/components/DashboardErrorBoundary';
import { RawApiOutput } from '@/components/RawApiOutput';
import { getFantasyProsPlayers } from '@/lib/fantasypros';

type DashboardTablePlayer = {
  id: string;
  name: string;
  team: string;
  position: string;
  ecr?: number;
  proj_pts?: number;
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
    ecr: player.overallRank ?? undefined,
    proj_pts: player.projectedPoints,
    advancedFields: {
      ...player.raw,
      overallRank: player.overallRank,
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
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-slate-900">NFL Fantasy Intelligence</h1>
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

        <div className="mt-8">
          <RawApiOutput payload={result.rawPayload} />
        </div>
      </div>
    </main>
  );
}

import DashboardClient from './DashboardClient';
import { DashboardErrorBoundary } from '@/components/DashboardErrorBoundary';

const FANTASY_PROS_ENDPOINT = 'https://api.fantasypros.com/v2/json/nfl/projections';
const REVALIDATE_SECONDS = 3600;
const FALLBACK_PLAYERS: Player[] = [
  { id: '1', name: 'Christian McCaffrey', team: 'SF', position: 'RB', ecr: 1, proj_pts: 21.5 },
  { id: '2', name: 'CeeDee Lamb', team: 'DAL', position: 'WR', ecr: 2, proj_pts: 19.8 },
  { id: '3', name: 'Josh Allen', team: 'BUF', position: 'QB', ecr: 15, proj_pts: 24.1 },
  { id: '4', name: 'Sam LaPorta', team: 'DET', position: 'TE', ecr: 28, proj_pts: 14.2 },
  { id: '5', name: 'Breece Hall', team: 'NYJ', position: 'RB', ecr: 6, proj_pts: 17.4 },
];

type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
  ecr?: number;
  proj_pts?: number;
};

type RawPlayer = {
  id?: string | number;
  player_id?: string | number;
  name?: string;
  player_name?: string;
  team?: string;
  team_abbr?: string;
  position?: string;
  pos?: string;
  ecr?: number | string;
  proj_pts?: number | string;
};

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeFantasyPlayers(payload: unknown): Player[] {
  const source = payload && typeof payload === 'object' && Array.isArray((payload as { players?: unknown[] }).players)
    ? ((payload as { players: unknown[] }).players ?? [])
    : [];

  const normalized: Player[] = source
    .map((item, index): Player | null => {
      if (!item || typeof item !== 'object') return null;
      const player = item as RawPlayer;
      const name = player.name ?? player.player_name;
      const team = player.team ?? player.team_abbr;
      const position = player.position ?? player.pos;

      if (!name || !team || !position) return null;

      return {
        id: String(player.id ?? player.player_id ?? `${name}-${position}-${index}`),
        name,
        team,
        position: position.toUpperCase(),
        ecr: toNumber(player.ecr),
        proj_pts: toNumber(player.proj_pts),
      };
    })
    .filter((player): player is Player => player !== null);

  console.log('[Page] Normalized FantasyPros payload', {
    rawCount: source.length,
    normalizedCount: normalized.length,
  });

  return normalized;
}

async function fetchFantasyData(): Promise<Player[] | null> {
  const apiKey = process.env.FANTASYPROS_API_KEY;
  console.log('[Page] Starting FantasyPros fetch', {
    endpoint: FANTASY_PROS_ENDPOINT,
    hasApiKey: Boolean(apiKey),
  });

  try {
    const res = await fetch(FANTASY_PROS_ENDPOINT, {
      headers: {
        'x-api-key': apiKey || '',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    console.log('[Page] FantasyPros response received', {
      ok: res.ok,
      status: res.status,
    });

    if (!res.ok) {
      throw new Error('Failed to fetch data');
    }

    const json = await res.json();
    return normalizeFantasyPlayers(json);
  } catch (error) {
    console.error('[Page] API Error:', error);
    return null;
  }
}

export default async function Page() {
  const data = await fetchFantasyData();

  const players = data && data.length > 0 ? data : FALLBACK_PLAYERS;

  console.log('[Page] Rendering dashboard', {
    source: data ? 'api' : 'fallback',
    playersCount: players.length,
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 md:p-12" data-testid="dashboard-page">
      <div className="mx-auto max-w-7xl" data-testid="dashboard-container">
        <header className="mb-8" data-testid="dashboard-header">
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-slate-900">NFL Fantasy Intelligence</h1>
          <p className="text-lg text-slate-500">Live player projections, rankings, and advanced metrics.</p>
        </header>

        <DashboardErrorBoundary>
          <DashboardClient initialData={players} />
        </DashboardErrorBoundary>
      </div>
    </main>
  );
}

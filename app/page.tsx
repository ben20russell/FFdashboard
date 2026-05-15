import { DashboardErrorBoundary } from '@/components/DashboardErrorBoundary';
import { ModelProjectionsTable } from '@/components/ModelProjectionsTable';
import { RawApiOutput } from '@/components/RawApiOutput';
import { StatCard } from '@/components/StatCard';
import { getFantasyProsPlayers } from '@/lib/fantasypros';

export default async function HomePage() {
  console.log('[HomePage] Rendering server component and requesting FantasyPros data');

  const result = await getFantasyProsPlayers();
  const isError = Boolean(result.errorMessage);

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6" data-testid="dashboard-root">
      <header className="mb-6" data-testid="dashboard-header">
        <h1 className="text-3xl font-black tracking-tight text-dashboard-text">🏆 Fantasy Football Model</h1>
        <p className="mt-2 text-sm text-dashboard-muted">
          Server-side fantasy football analytics starter with secure API access and ISR caching.
        </p>
      </header>

      <DashboardErrorBoundary>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="top-stat-grid">
          <StatCard
            title="Model Status"
            value={isError ? 'Error' : 'Active'}
            subtitle={result.errorMessage ?? 'Data loaded via server component with 1-hour ISR.'}
            valueTone={isError ? 'error' : 'success'}
            testId="stat-model-status"
          />
          <StatCard
            title="Players Tracked"
            value={result.players.length}
            subtitle="Count of players from latest API payload"
            testId="stat-players-tracked"
          />
          <StatCard
            title="Last Updated"
            value={new Date(result.fetchedAtIso).toLocaleString()}
            subtitle="Server timestamp for current rendered data"
            testId="stat-last-updated"
          />
        </section>

        <section className="mt-6" data-testid="model-projections-container">
          <ModelProjectionsTable players={result.players} />
        </section>

        <section className="mt-6" data-testid="raw-output-container">
          <RawApiOutput payload={result.rawPayload} />
        </section>
      </DashboardErrorBoundary>
    </main>
  );
}

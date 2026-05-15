import type { DashboardPlayer } from '@/types/player';

type ModelProjectionsTableProps = {
  players: DashboardPlayer[];
};

export function ModelProjectionsTable({ players }: ModelProjectionsTableProps) {
  console.log('[ModelProjectionsTable] Rendering table', { receivedPlayers: players.length });

  const sortedPlayers = [...players].sort((a, b) => b.customValueScore - a.customValueScore);

  return (
    <section
      className="rounded-xl border border-dashboard-border bg-dashboard-card p-5 shadow-soft"
      data-testid="model-projections-section"
    >
      <h2 className="text-lg font-semibold text-dashboard-text">Model Projections</h2>
      <p className="mt-1 text-sm text-dashboard-muted">
        Placeholder ranking table for projected points and custom value scoring.
      </p>

      <div className="mt-4 overflow-x-auto" data-testid="projections-table-wrapper">
        <table className="min-w-full divide-y divide-dashboard-border" data-testid="projections-table">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-dashboard-muted">Name</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-dashboard-muted">Position</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-dashboard-muted">Projected Points</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-dashboard-muted">Custom Value Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashboard-border">
            {sortedPlayers.length === 0 ? (
              <tr data-testid="projection-empty-state">
                <td colSpan={4} className="px-3 py-5 text-sm text-dashboard-muted">
                  No player data available yet. Confirm API access and payload structure.
                </td>
              </tr>
            ) : (
              sortedPlayers.map((player, index) => (
                <tr key={player.id} data-testid={`projection-row-${index + 1}`}>
                  <td className="px-3 py-2 text-sm font-medium text-dashboard-text">{player.name}</td>
                  <td className="px-3 py-2 text-sm text-dashboard-muted">{player.position}</td>
                  <td className="px-3 py-2 text-sm text-dashboard-muted">{player.projectedPoints.toFixed(2)}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-dashboard-accent">{player.customValueScore.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

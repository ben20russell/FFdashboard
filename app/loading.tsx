export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6" data-testid="loading-state">
      <div className="animate-pulse rounded-xl border border-dashboard-border bg-dashboard-card p-6 shadow-soft">
        <p className="text-sm text-dashboard-muted">Loading fantasy football dashboard...</p>
      </div>
    </main>
  );
}

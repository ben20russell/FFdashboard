type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  testId: string;
  valueTone?: 'default' | 'success' | 'error';
};

export function StatCard({ title, value, subtitle, testId, valueTone = 'default' }: StatCardProps) {
  console.log('[StatCard] Rendering stat card', { title, value, testId, valueTone });

  const toneClassName =
    valueTone === 'success'
      ? 'text-dashboard-success'
      : valueTone === 'error'
        ? 'text-dashboard-error'
        : 'text-dashboard-text';

  return (
    <article
      className="rounded-xl border border-dashboard-border bg-dashboard-card p-5 shadow-soft"
      data-testid={testId}
    >
      <h2 className="text-sm font-medium uppercase tracking-wide text-dashboard-muted">{title}</h2>
      <p className={`mt-2 text-2xl font-bold ${toneClassName}`}>{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-dashboard-muted">{subtitle}</p> : null}
    </article>
  );
}

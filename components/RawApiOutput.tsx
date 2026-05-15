type RawApiOutputProps = {
  payload: unknown;
};

export function RawApiOutput({ payload }: RawApiOutputProps) {
  console.log('[RawApiOutput] Rendering raw payload card');

  return (
    <section
      className="rounded-xl border border-dashboard-border bg-dashboard-card p-5 shadow-soft"
      data-testid="raw-output-card"
    >
      <details open>
        <summary className="cursor-pointer text-lg font-semibold text-dashboard-text" data-testid="raw-output-summary">
          Developer / Raw API Output
        </summary>
        <p className="mt-1 text-sm text-dashboard-muted">
          Expand this payload to inspect the live API structure while developing your model logic.
        </p>
        <div className="mt-4 max-h-96 overflow-auto rounded-md bg-slate-900 p-4" data-testid="raw-output-scroll-container">
          <pre className="text-xs text-slate-100" data-testid="raw-api-output">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      </details>
    </section>
  );
}

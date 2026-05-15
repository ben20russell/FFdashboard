'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] App-level error boundary triggered', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-dashboard-bg p-6" data-testid="global-error-state">
        <div className="mx-auto max-w-3xl rounded-xl border border-dashboard-border bg-dashboard-card p-6 shadow-soft">
          <h2 className="text-xl font-bold text-dashboard-error">Something went wrong.</h2>
          <p className="mt-2 text-dashboard-muted">
            We could not load the dashboard. Please try again, and if the issue continues check API key and endpoint settings.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-md bg-dashboard-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            data-testid="global-error-retry"
          >
            Retry Dashboard
          </button>
        </div>
      </body>
    </html>
  );
}

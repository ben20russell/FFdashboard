'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export class DashboardErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[DashboardErrorBoundary] Component-level crash', {
      error,
      errorInfo,
    });
  }

  private handleRecovery = () => {
    console.log('[DashboardErrorBoundary] Attempting local recovery');
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl border border-dashboard-border bg-dashboard-card p-6 shadow-soft"
          data-testid="dashboard-component-error"
        >
          <h3 className="text-lg font-bold text-dashboard-error">Dashboard section failed to render.</h3>
          <p className="mt-2 text-sm text-dashboard-muted">
            Try refreshing this section. If this keeps happening, inspect logs and API payload shape.
          </p>
          {this.state.errorMessage ? (
            <p className="mt-2 font-mono text-xs text-dashboard-muted" data-testid="dashboard-error-message">
              Error: {this.state.errorMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={this.handleRecovery}
            className="mt-4 rounded-md bg-dashboard-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            data-testid="dashboard-error-recover"
          >
            Recover Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

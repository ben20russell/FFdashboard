import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import DashboardClient from '@/app/DashboardClient';

const players = [
  {
    id: '1',
    name: 'Christian McCaffrey',
    team: 'SF',
    position: 'RB',
    ecr: 1,
    proj_pts: 21.5,
    advancedFields: { injuryStatus: null, customValueScore: 92.4, projection: { points: 21.5 } },
  },
  {
    id: '2',
    name: 'CeeDee Lamb',
    team: 'DAL',
    position: 'WR',
    ecr: 2,
    proj_pts: 19.8,
    advancedFields: { injuryStatus: 'Questionable', customValueScore: 89.1, projection: { points: 19.8 } },
  },
  {
    id: '3',
    name: 'Josh Allen',
    team: 'BUF',
    position: 'QB',
    ecr: 15,
    proj_pts: 24.1,
    advancedFields: { injuryStatus: null, customValueScore: 88.6, projection: { points: 24.1 } },
  },
];

describe('DashboardClient', () => {
  it('renders rows from initial data', () => {
    render(<DashboardClient initialData={players} />);

    expect(screen.getByTestId('player-row-1')).toBeInTheDocument();
    expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument();
    expect(screen.getByText('Josh Allen')).toBeInTheDocument();
  });

  it('filters by search query', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.change(screen.getByTestId('player-search-input'), { target: { value: 'josh' } });

    expect(screen.getByText('Josh Allen')).toBeInTheDocument();
    expect(screen.queryByText('CeeDee Lamb')).not.toBeInTheDocument();
  });

  it('filters by position button', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('position-filter-qb'));

    expect(screen.getByText('Josh Allen')).toBeInTheDocument();
    expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument();
  });

  it('sorts by ECR ascending then descending', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('sort-ecr'));
    let rows = screen.getAllByTestId(/player-row-/);
    expect(rows[0]).toHaveTextContent('Christian McCaffrey');

    fireEvent.click(screen.getByTestId('sort-ecr'));
    rows = screen.getAllByTestId(/player-row-/);
    expect(rows[0]).toHaveTextContent('Josh Allen');
  });

  it('shows empty state when no rows match', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.change(screen.getByTestId('player-search-input'), { target: { value: 'not-a-player' } });

    expect(screen.getByTestId('dashboard-empty-state')).toBeInTheDocument();
  });

  it('renders zero values instead of empty placeholders', () => {
    render(
      <DashboardClient
        initialData={[{ id: 'z1', name: 'Zero Player', team: 'DET', position: 'QB', ecr: 0, proj_pts: 0 }]}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });

  it('shows dynamic advanced columns and renders values after toggle', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('advanced-columns-toggle'));
    fireEvent.click(screen.getByText('customValueScore'));

    expect(screen.getByTestId('advanced-header-customValueScore')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-cell-1-customValueScore')).toHaveTextContent('92.4');
  });

  it('renders nested advanced values and fallback dashes', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('advanced-columns-toggle'));
    fireEvent.click(screen.getByText('injuryStatus'));
    fireEvent.click(screen.getByText('projection.points'));

    expect(screen.getByTestId('advanced-cell-1-injuryStatus')).toHaveTextContent('-');
    expect(screen.getByTestId('advanced-cell-2-injuryStatus')).toHaveTextContent('Questionable');
    expect(screen.getByTestId('advanced-cell-3-projection_points')).toHaveTextContent('24.1');
  });
});

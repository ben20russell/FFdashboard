import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import DashboardClient, { computeLeagueAdjustedProjection } from '@/app/DashboardClient';

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

    expect(screen.getByTestId('tab-player-rankings')).toHaveAttribute('aria-selected', 'true');
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

  it('sorts advanced columns ascending then descending', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('advanced-columns-toggle'));
    fireEvent.click(screen.getByText('customValueScore'));

    fireEvent.click(screen.getByTestId('advanced-header-customValueScore'));
    let rows = screen.getAllByTestId(/player-row-/);
    expect(rows[0]).toHaveTextContent('Josh Allen');

    fireEvent.click(screen.getByTestId('advanced-header-customValueScore'));
    rows = screen.getAllByTestId(/player-row-/);
    expect(rows[0]).toHaveTextContent('Christian McCaffrey');
  });

  it('renders a 12-team draft board with 12 rounds', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-root')).toBeInTheDocument();
    expect(screen.getAllByTestId(/draft-board-row-/)).toHaveLength(12);
    expect(screen.getByTestId('draft-board-pick-1')).toHaveTextContent('1');
    expect(screen.getByTestId('draft-board-pick-2')).toHaveTextContent('24');
    expect(screen.getByText('Likely Pick')).toBeInTheDocument();
    expect(screen.getByTestId('draft-board-likely-1')).toHaveTextContent('Josh Allen (QB)');
  });

  it('recomputes snake picks when draft position changes', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('tab-draft-board'));
    fireEvent.change(screen.getByTestId('draft-position-select'), { target: { value: '12' } });

    expect(screen.getByTestId('draft-board-pick-1')).toHaveTextContent('12');
    expect(screen.getByTestId('draft-board-pick-2')).toHaveTextContent('13');
  });

  it('switches between draft board and player rankings tabs', () => {
    render(<DashboardClient initialData={players} />);

    expect(screen.getByTestId('players-table')).toBeInTheDocument();
    expect(screen.queryByTestId('draft-board-root')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-draft-board'));
    expect(screen.getByTestId('draft-board-root')).toBeInTheDocument();
    expect(screen.queryByTestId('players-table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-player-rankings'));
    expect(screen.getByTestId('players-table')).toBeInTheDocument();
    expect(screen.queryByTestId('draft-board-root')).not.toBeInTheDocument();
  });

  it('uses league scoring settings when projection stat details are available', () => {
    const result = computeLeagueAdjustedProjection({
      id: 'qb-league-adjusted',
      name: 'League QB',
      team: 'BUF',
      position: 'QB',
      ecr: 10,
      proj_pts: 10,
      advancedFields: {
        projection: {
          stats: [
            {
              pass_yds: 300,
              pass_td: 3,
              interceptions: 1,
              rush_yds: 20,
            },
          ],
        },
      },
    });

    expect(result.usedDetailedStats).toBe(true);
    expect(result.points).toBe(29);
  });
});

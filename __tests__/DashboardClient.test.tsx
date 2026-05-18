import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import DashboardClient, {
  assignPlayerTiers,
  calculateReplacementRanks,
  computeLeagueAdjustedProjection,
  DEFAULT_ROSTER_SETTINGS,
} from '@/app/DashboardClient';

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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it('refreshes player data from FantasyPros refresh endpoint', async () => {
    const refreshedPlayers = [
      {
        id: '99',
        name: 'Refreshed Player',
        team: 'KC',
        position: 'WR',
        ecr: 9,
        proj_pts: 18.5,
        advancedFields: {},
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        players: refreshedPlayers,
        fetchedAtIso: '2026-08-15T12:00:00.000Z',
        errorMessage: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('refresh-data-button'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/fantasypros/refresh', {
        method: 'GET',
        cache: 'no-store',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Refreshed Player')).toBeInTheDocument();
    });
    expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument();
    expect(screen.getByTestId('refresh-last-updated')).toHaveTextContent('Last updated:');
  });

  it('filters by position button', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('position-filter-qb'));

    expect(screen.getByText('Josh Allen')).toBeInTheDocument();
    expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument();
  });

  it('filters by FLEX button to show only RB, WR, and TE', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('position-filter-flex'));

    expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument();
    expect(screen.getByText('CeeDee Lamb')).toBeInTheDocument();
    expect(screen.queryByText('Josh Allen')).not.toBeInTheDocument();
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

  it('surfaces targets_per_route_run and yprr as toggleable advanced columns', () => {
    const advancedMetricPlayers = [
      {
        id: 'm1',
        name: 'Metric WR',
        team: 'MIA',
        position: 'WR',
        ecr: 8,
        proj_pts: 16,
        advancedFields: {
          projection: {
            stats: [{ targets_per_route_run: 0.31, yprr: 2.4 }],
          },
        },
      },
    ];

    render(<DashboardClient initialData={advancedMetricPlayers} />);

    expect(screen.getByTestId('advanced-header-targets_per_route_run')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-yprr')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-cell-m1-targets_per_route_run')).toHaveTextContent('0.31');
    expect(screen.getByTestId('advanced-cell-m1-yprr')).toHaveTextContent('2.4');
  });

  it('keeps core draft-model metrics always visible and exposes others in the dropdown', () => {
    const syntheticMetricPlayers = [
      {
        id: 's1',
        name: 'Synthetic Metrics RB',
        team: 'DET',
        position: 'RB',
        ecr: 18,
        proj_pts: 14,
        isRookie: true,
        advancedFields: {
          isRookie: true,
          std_dev: 5.1,
          targetShare: 0.22,
          redZoneTargets: 14,
          greenZoneTouches: 28,
          gamesPlayed: 14,
          projection: {
            stats: [{ targets_per_route_run: 0.27, yprr: 2.1 }],
          },
        },
      },
    ];

    render(<DashboardClient initialData={syntheticMetricPlayers} />);

    expect(screen.getByTestId('advanced-header-volatility')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-week_1_points')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-week_2_points')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-week_3_points')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-week_4_points')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-early_season_points')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-target_share')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-is_rookie')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-green_zone_touches_per_game')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-targets_per_route_run')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-header-yprr')).toBeInTheDocument();

    expect(screen.queryByTestId('advanced-header-red_zone_targets')).not.toBeInTheDocument();
    expect(screen.queryByTestId('advanced-header-green_zone_touches')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('advanced-columns-toggle'));
    expect(screen.getByText('red_zone_targets')).toBeInTheDocument();
    expect(screen.getByText('green_zone_touches')).toBeInTheDocument();
  });

  it('renders Volatility advanced column using std_dev data', () => {
    const volatilityPlayers = [
      {
        id: 'v1',
        name: 'Boom WR',
        team: 'MIA',
        position: 'WR',
        ecr: 11,
        proj_pts: 17,
        advancedFields: { std_dev: 6.3 },
      },
    ];

    render(<DashboardClient initialData={volatilityPlayers} />);

    expect(screen.getByTestId('advanced-header-volatility')).toHaveTextContent('Volatility');
    expect(screen.getByTestId('advanced-cell-v1-volatility')).toHaveTextContent('6.3');
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

  it('creates tiers when positional projection gaps exceed 1.5 points', () => {
    const tierMap = assignPlayerTiers([
      { id: 'qb-1', position: 'QB', leagueAdjustedPoints: 24 },
      { id: 'qb-2', position: 'QB', leagueAdjustedPoints: 22.6 },
      { id: 'qb-3', position: 'QB', leagueAdjustedPoints: 20.9 },
      { id: 'wr-1', position: 'WR', leagueAdjustedPoints: 20.5 },
      { id: 'wr-2', position: 'WR', leagueAdjustedPoints: 20 },
      { id: 'wr-3', position: 'WR', leagueAdjustedPoints: 18.3 },
    ]);

    expect(tierMap.get('qb-1')).toBe(1);
    expect(tierMap.get('qb-2')).toBe(1);
    expect(tierMap.get('qb-3')).toBe(2);
    expect(tierMap.get('wr-1')).toBe(1);
    expect(tierMap.get('wr-2')).toBe(1);
    expect(tierMap.get('wr-3')).toBe(2);
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

  it('boosts a last-in-tier starter with Tier Drop Warning to draft before the cliff', () => {
    const tierDropPlayers = [
      { id: 'wr-1', name: 'WR Stable 1', team: 'DAL', position: 'WR', ecr: 1, adp: 1, proj_pts: 21.2 },
      { id: 'wr-2', name: 'WR Stable 2', team: 'MIA', position: 'WR', ecr: 2, adp: 2, proj_pts: 20.6 },
      { id: 'wr-3', name: 'WR Stable 3', team: 'DET', position: 'WR', ecr: 3, adp: 3, proj_pts: 18.8 },
      { id: 'te-1', name: 'TE Cliff', team: 'KC', position: 'TE', ecr: 4, adp: 4, proj_pts: 20.5 },
      { id: 'te-2', name: 'TE Drop', team: 'BUF', position: 'TE', ecr: 5, adp: 5, proj_pts: 18.8 },
    ];

    render(<DashboardClient initialData={tierDropPlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('TE Cliff (TE)');
  });

  it('activates Hero RB path in round 2 when one RB is drafted in round 1', () => {
    const heroRbPlayers = [
      { id: 'rb-anchor', name: 'RB Anchor', team: 'SF', position: 'RB', ecr: 1, adp: 1, proj_pts: 30 },
      { id: 'wr-1', name: 'WR One', team: 'MIA', position: 'WR', ecr: 2, adp: 2, proj_pts: 21 },
      { id: 'te-elite', name: 'Elite TE', team: 'KC', position: 'TE', ecr: 8, adp: 20, proj_pts: 17 },
      { id: 'rb-2', name: 'RB Two', team: 'BAL', position: 'RB', ecr: 10, adp: 18, proj_pts: 18 },
    ];

    render(<DashboardClient initialData={heroRbPlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('RB Anchor (RB)');
    expect(screen.getByTestId('draft-board-row-2')).toHaveTextContent('Hero RB active');
  });

  it('activates Zero RB path in rounds 3-6 when no RB is drafted through round 2', () => {
    const zeroRbPlayers = [
      { id: 'wr-alpha', name: 'WR Alpha', team: 'DET', position: 'WR', ecr: 1, adp: 1, proj_pts: 28 },
      { id: 'wr-beta', name: 'WR Beta', team: 'DAL', position: 'WR', ecr: 2, adp: 2, proj_pts: 25 },
      { id: 'te-elite', name: 'Elite TE', team: 'KC', position: 'TE', ecr: 3, adp: 15, proj_pts: 20 },
      { id: 'rb-fade', name: 'RB Fade', team: 'CAR', position: 'RB', ecr: 20, adp: 200, proj_pts: 7 },
      { id: 'rb-fade-2', name: 'RB Fade 2', team: 'LV', position: 'RB', ecr: 21, adp: 210, proj_pts: 6.5 },
    ];

    render(<DashboardClient initialData={zeroRbPlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-row-3')).toHaveTextContent('Zero RB active');
    expect(screen.getByTestId('draft-board-primary-3')).not.toHaveTextContent('RB Fade');
    expect(screen.getByTestId('draft-board-primary-3')).not.toHaveTextContent('RB Fade 2');
  });

  it('shows a Stack badge when a recommendation completes a QB/WR or QB/TE stack', () => {
    const stackPlayers = [
      { id: 'qb-buf', name: 'Stack QB', team: 'BUF', position: 'QB', ecr: 1, adp: 1, proj_pts: 35 },
      { id: 'wr-buf', name: 'Stack WR', team: 'BUF', position: 'WR', ecr: 90, adp: 95, proj_pts: 8 },
      { id: 'wr-dal', name: 'Other WR', team: 'DAL', position: 'WR', ecr: 89, adp: 94, proj_pts: 8 },
    ];

    render(<DashboardClient initialData={stackPlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('Stack QB (QB)');
    expect(screen.getByTestId('draft-board-primary-2')).toHaveTextContent('Stack WR (WR)');
    expect(screen.getByTestId('draft-board-stack-badge-2')).toHaveTextContent('Stack');
  });

  it('applies rookie late-season breakout coefficient for WR/RB by boosting ceiling points', () => {
    const result = computeLeagueAdjustedProjection({
      id: 'rookie-wr',
      name: 'Rookie WR',
      team: 'LAR',
      position: 'WR',
      proj_pts: 20,
      isRookie: true,
      advancedFields: {},
    });

    expect(result.usedDetailedStats).toBe(false);
    expect(result.ceilingPoints).toBe(30.26);
    expect(result.rookieLateSeasonBreakoutApplied).toBe(true);
  });

  it('adds rookie draft-score boost and shows Rookie Upside badge on draft recommendations', () => {
    const rookieUpsidePlayers = [
      { id: 'rookie-wr', name: 'Rookie WR', team: 'MIA', position: 'WR', ecr: 10, adp: 10, proj_pts: 20, isRookie: true },
      { id: 'veteran-wr', name: 'Veteran WR', team: 'DAL', position: 'WR', ecr: 10, adp: 10, proj_pts: 20, isRookie: false },
    ];

    render(<DashboardClient initialData={rookieUpsidePlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('Rookie WR (WR)');
    expect(screen.getByTestId('draft-board-rookie-badge-1')).toHaveTextContent('Rookie Upside');
  });

  it('optimizes draft strategy messaging based on draft position', () => {
    render(<DashboardClient initialData={players} />);

    fireEvent.click(screen.getByTestId('tab-draft-board'));
    expect(screen.getByTestId('draft-board-row-1')).toHaveTextContent('Hero RB');

    fireEvent.change(screen.getByTestId('draft-position-select'), { target: { value: '12' } });
    expect(screen.getByTestId('draft-board-row-1')).toHaveTextContent('Elite WR');
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
    expect(result.medianPoints).toBe(28.15);
    expect(result.floorPoints).toBeLessThan(result.medianPoints);
    expect(result.ceilingPoints).toBeGreaterThan(result.medianPoints);
    expect(result.upsideProbability).toBeGreaterThan(0);
  });

  it('calculates replacement ranks from roster settings instead of hardcoded values', () => {
    const defaultRanks = calculateReplacementRanks(DEFAULT_ROSTER_SETTINGS);
    expect(defaultRanks).toEqual({ QB: 15, RB: 35, WR: 47, TE: 19 });

    const twoFlexLeagueRanks = calculateReplacementRanks({
      ...DEFAULT_ROSTER_SETTINGS,
      flexSpots: 2,
    });
    expect(twoFlexLeagueRanks.RB).toBeGreaterThan(defaultRanks.RB);
    expect(twoFlexLeagueRanks.WR).toBeGreaterThan(defaultRanks.WR);
    expect(twoFlexLeagueRanks.QB).toBe(defaultRanks.QB);
  });

  it('boosts league-adjusted projection for players above 25% target share', () => {
    const result = computeLeagueAdjustedProjection({
      id: 'wr-target-share',
      name: 'Target Hog WR',
      team: 'LAR',
      position: 'WR',
      proj_pts: 14,
      advancedFields: {
        projection: {
          stats: [{ rec_yds: 100, rec_td: 1 }],
        },
        targetShare: 0.3,
      },
    });

    expect(result.usedDetailedStats).toBe(true);
    expect(result.medianPoints).toBe(17.82);
    expect(result.upsideProbability).toBeGreaterThan(40);
  });

  it('boosts league-adjusted projection for players above 1.5 green-zone touches per game', () => {
    const result = computeLeagueAdjustedProjection({
      id: 'rb-green-zone',
      name: 'Goal Line RB',
      team: 'DET',
      position: 'RB',
      proj_pts: 16,
      advancedFields: {
        projection: {
          stats: [{ rush_yds: 80, rush_td: 1 }],
        },
        greenZoneTouches: 30,
        gamesPlayed: 10,
      },
    });

    expect(result.usedDetailedStats).toBe(true);
    expect(result.medianPoints).toBe(14.68);
    expect(result.upsideProbability).toBeGreaterThan(40);
  });

  it('applies expected-games-played reduction for questionable injury status', () => {
    const result = computeLeagueAdjustedProjection({
      id: 'wr-questionable',
      name: 'Questionable WR',
      team: 'SEA',
      position: 'WR',
      proj_pts: 17,
      advancedFields: {
        injuryStatus: 'Questionable',
      },
    });

    expect(result.usedDetailedStats).toBe(false);
    expect(result.medianPoints).toBe(14.7);
  });

  it('applies playoff strength-of-schedule shift for easy and hard schedules', () => {
    const easySchedule = computeLeagueAdjustedProjection({
      id: 'rb-easy-playoff',
      name: 'Easy Schedule RB',
      team: 'DET',
      position: 'RB',
      proj_pts: 20,
      advancedFields: {
        strengthOfSchedule: 'easy',
      },
    });

    const hardSchedule = computeLeagueAdjustedProjection({
      id: 'rb-hard-playoff',
      name: 'Hard Schedule RB',
      team: 'DET',
      position: 'RB',
      proj_pts: 20,
      advancedFields: {
        strengthOfSchedule: 'hard',
      },
    });

    expect(easySchedule.usedDetailedStats).toBe(false);
    expect(hardSchedule.usedDetailedStats).toBe(false);
    expect(easySchedule.medianPoints).toBe(21.2);
    expect(hardSchedule.medianPoints).toBe(19.18);
  });

  it('switches draft board recommendation weighting when matchup-winning ceiling mode is enabled', () => {
    const modePlayers = [
      { id: 'safe-wr', name: 'Safe WR', team: 'DAL', position: 'WR', ecr: 1, adp: 1, proj_pts: 30 },
      {
        id: 'ceiling-wr',
        name: 'Ceiling WR',
        team: 'MIA',
        position: 'WR',
        ecr: 2,
        adp: 2,
        proj_pts: 28,
        advancedFields: { targetShare: 0.3, greenZoneTouchesPerGame: 2.2 },
      },
    ];

    render(<DashboardClient initialData={modePlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('Safe WR (WR)');

    fireEvent.click(screen.getByTestId('draft-mode-matchup-winning-ceiling'));
    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('Ceiling WR (WR)');
  });

  it('applies breakout coefficient for WR/TE with elite TPRR or YPRR', () => {
    const breakoutPlayers = [
      {
        id: 'wr-safe',
        name: 'Safe WR',
        team: 'DAL',
        position: 'WR',
        ecr: 10,
        adp: 10,
        proj_pts: 20,
        advancedFields: {
          projection: {
            stats: [{ targets_per_route_run: 0.2, yprr: 1.7 }],
          },
        },
      },
      {
        id: 'wr-breakout',
        name: 'Breakout WR',
        team: 'MIA',
        position: 'WR',
        ecr: 10,
        adp: 10,
        proj_pts: 20,
        advancedFields: {
          projection: {
            stats: [{ targets_per_route_run: 0.3, yprr: 2.2 }],
          },
        },
      },
    ];

    render(<DashboardClient initialData={breakoutPlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('Breakout WR (WR)');
  });

  it('applies a hot-start bonus when early-season pace is meaningfully above season-long pace', () => {
    const hotStartPlayers = [
      {
        id: 'steady-wr',
        name: 'Steady WR',
        team: 'DAL',
        position: 'WR',
        ecr: 10,
        adp: 10,
        proj_pts: 20,
        advancedFields: {
          earlySeasonPoints: 68,
        },
      },
      {
        id: 'hot-wr',
        name: 'Hot Start WR',
        team: 'MIA',
        position: 'WR',
        ecr: 10,
        adp: 10,
        proj_pts: 20,
        advancedFields: {
          earlySeasonPoints: 96,
        },
      },
    ];

    render(<DashboardClient initialData={hotStartPlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('Hot Start WR (WR)');
  });

  it("doesn't recommend a round-4 reach when ADP indicates the player will be there in round 6", () => {
    const adpAwarePlayers = [
      { id: 'a', name: 'Anchor RB', team: 'SF', position: 'RB', ecr: 1, adp: 2, proj_pts: 28 },
      { id: 'b', name: 'Anchor WR', team: 'DET', position: 'WR', ecr: 2, adp: 14, proj_pts: 25 },
      { id: 'c', name: 'Anchor QB', team: 'BUF', position: 'QB', ecr: 3, adp: 26, proj_pts: 24 },
      { id: 'd', name: 'Late ADP Upside', team: 'MIA', position: 'WR', ecr: 4, adp: 80, proj_pts: 30 },
      { id: 'e', name: 'Round 4 Value', team: 'LAR', position: 'WR', ecr: 20, adp: 42, proj_pts: 19 },
    ];

    render(<DashboardClient initialData={adpAwarePlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-pick-4')).toHaveTextContent('48');
    expect(screen.getByTestId('draft-board-primary-4')).not.toHaveTextContent('Late ADP Upside (WR)');
  });

  it('applies upside variance boost in round 7+ for high-std-dev players', () => {
    const variancePlayers = [
      { id: 'w1', name: 'Early WR 1', team: 'DAL', position: 'WR', ecr: 1, adp: 1, proj_pts: 32 },
      { id: 'w2', name: 'Early WR 2', team: 'MIA', position: 'WR', ecr: 2, adp: 2, proj_pts: 31 },
      { id: 'w3', name: 'Early WR 3', team: 'DET', position: 'WR', ecr: 3, adp: 3, proj_pts: 30 },
      { id: 'w4', name: 'Early WR 4', team: 'BUF', position: 'WR', ecr: 4, adp: 4, proj_pts: 29 },
      { id: 'w5', name: 'Early WR 5', team: 'KC', position: 'WR', ecr: 5, adp: 5, proj_pts: 28 },
      { id: 'w6', name: 'Early WR 6', team: 'PHI', position: 'WR', ecr: 6, adp: 6, proj_pts: 27 },
      { id: 'steady', name: 'Steady Late WR', team: 'SEA', position: 'WR', ecr: 80, adp: 90, proj_pts: 15 },
      {
        id: 'volatile',
        name: 'Volatile Late WR',
        team: 'LAR',
        position: 'WR',
        ecr: 81,
        adp: 91,
        proj_pts: 14.8,
        advancedFields: { std_dev: 6.2 },
      },
    ];

    render(<DashboardClient initialData={variancePlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-7')).toHaveTextContent('Volatile Late WR (WR)');
  });

  it('applies a bye-week conflict penalty for same-position overlaps on drafted roster', () => {
    const byeWeekPlayers = [
      {
        id: 'wr-anchor',
        name: 'WR Anchor',
        team: 'DAL',
        position: 'WR',
        ecr: 1,
        adp: 1,
        proj_pts: 30,
        byeWeek: 7,
        advancedFields: { bye_week: 7 },
      },
      {
        id: 'wr-conflict',
        name: 'WR Conflict',
        team: 'MIA',
        position: 'WR',
        ecr: 20,
        adp: 20,
        proj_pts: 22,
        byeWeek: 7,
        advancedFields: { bye_week: 7 },
      },
      {
        id: 'wr-alt',
        name: 'WR Alt',
        team: 'DET',
        position: 'WR',
        ecr: 21,
        adp: 21,
        proj_pts: 21.4,
        byeWeek: 9,
        advancedFields: { bye_week: 9 },
      },
    ];

    render(<DashboardClient initialData={byeWeekPlayers} />);
    fireEvent.click(screen.getByTestId('tab-draft-board'));

    expect(screen.getByTestId('draft-board-primary-1')).toHaveTextContent('WR Anchor (WR)');
    expect(screen.getByTestId('draft-board-primary-2')).toHaveTextContent('WR Alt (WR)');
  });
});

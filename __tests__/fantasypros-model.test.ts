import { describe, expect, it } from 'vitest';

import { buildFullFantasyProsModel } from '@/lib/fantasypros';

describe('buildFullFantasyProsModel', () => {
  it('merges players, rankings, projections, and injuries into a unified model', () => {
    const result = buildFullFantasyProsModel({
      players: [
        { id: 1, name: 'Player One', position: 'QB' },
        { id: 2, name: 'Player Two', position: 'RB' },
      ],
      rankings: [{ player_name: 'Player One', rank: 5 }],
      projections: [
        { id: 1, projected_points: '20.5' },
        { id: 2, projected_points: '17.2' },
      ],
      injuries: [{ player_name: 'Player Two', status: 'Questionable' }],
    });

    expect(result.players).toHaveLength(2);

    const playerOne = result.players.find((player) => player.name === 'Player One');
    const playerTwo = result.players.find((player) => player.name === 'Player Two');

    expect(playerOne?.overallRank).toBe(5);
    expect(playerOne?.projectedPoints).toBe(20.5);
    expect(playerOne?.injuryStatus).toBeNull();

    expect(playerTwo?.overallRank).toBeNull();
    expect(playerTwo?.projectedPoints).toBe(17.2);
    expect(playerTwo?.injuryStatus).toBe('Questionable');
  });

  it('includes players that exist only in projections/rankings', () => {
    const result = buildFullFantasyProsModel({
      players: [],
      rankings: [{ player_name: 'Projection Only', rank: 33, position: 'WR' }],
      projections: [{ player_name: 'Projection Only', projected_points: 13.4 }],
      injuries: [],
    });

    expect(result.players).toHaveLength(1);
    expect(result.players[0]?.name).toBe('Projection Only');
    expect(result.players[0]?.overallRank).toBe(33);
    expect(result.players[0]?.position).toBe('WR');
    expect(result.players[0]?.projectedPoints).toBe(13.4);
  });

  it('parses nested ranking/projection payload shapes from official endpoints', () => {
    const result = buildFullFantasyProsModel({
      players: [{ id: 7354, player_name: 'Saquon Barkley', position_id: 'RB', team_id: 'PHI' }],
      rankings: [{ id: 7354, player_name: 'Saquon Barkley', rank_ecr: '2', position_id: 'RB', adp: '7.4' }],
      projections: [{ id: 7354, player_name: 'Saquon Barkley', position_id: 'RB', stats: [{ points: '18.4' }] }],
      injuries: [],
    });

    expect(result.players).toHaveLength(1);
    expect(result.players[0]?.overallRank).toBe(2);
    expect(result.players[0]?.adp).toBe(7.4);
    expect(result.players[0]?.projectedPoints).toBe(18.4);
    expect(result.players[0]?.position).toBe('RB');
  });

  it('keeps base player records when supplemental sources are empty', () => {
    const result = buildFullFantasyProsModel({
      players: [
        { id: 10, player_name: 'Only Players Feed QB', position_id: 'QB', team_id: 'BUF' },
        { id: 11, player_name: 'Only Players Feed WR', position_id: 'WR', team_id: 'MIA' },
      ],
      rankings: [],
      projections: [],
      injuries: [],
    });

    expect(result.players).toHaveLength(2);
    expect(result.players.map((player) => player.name)).toEqual([
      'Only Players Feed QB',
      'Only Players Feed WR',
    ]);
    expect(result.players[0]?.projectedPoints).toBe(0);
    expect(result.players[0]?.overallRank).toBeNull();
    expect(result.players[0]?.injuryStatus).toBeNull();
  });

  it('does not collapse different players who share a name but differ by team/position when ids are missing', () => {
    const result = buildFullFantasyProsModel({
      players: [],
      rankings: [
        { player_name: 'J. Williams', position_id: 'WR', team_id: 'DET', rank_ecr: '40' },
        { player_name: 'J. Williams', position_id: 'RB', team_id: 'DEN', rank_ecr: '55' },
      ],
      projections: [
        { player_name: 'J. Williams', position_id: 'WR', team_id: 'DET', projected_points: '12.3' },
        { player_name: 'J. Williams', position_id: 'RB', team_id: 'DEN', projected_points: '9.1' },
      ],
      injuries: [],
    });

    expect(result.players).toHaveLength(2);
    expect(result.players.map((player) => player.position).sort()).toEqual(['RB', 'WR']);
  });

  it('removes kickers from merged model output', () => {
    const result = buildFullFantasyProsModel({
      players: [{ id: 91, player_name: 'Kicker Player', position_id: 'K', team_id: 'BUF' }],
      rankings: [{ id: 91, player_name: 'Kicker Player', position_id: 'K', rank_ecr: '120' }],
      projections: [{ id: 91, player_name: 'Kicker Player', position_id: 'K', projected_points: '8.2' }],
      injuries: [],
    });

    expect(result.players).toHaveLength(0);
  });

  it('scales pass-catcher projections down when team receiving yards exceed team passing pie baseline', () => {
    const result = buildFullFantasyProsModel({
      players: [],
      rankings: [],
      projections: [
        {
          id: 201,
          player_name: 'Alpha WR',
          position_id: 'WR',
          team_id: 'KC',
          projected_points: '30',
          stats: [{ rec_yds: '3000' }],
        },
        {
          id: 202,
          player_name: 'Beta TE',
          position_id: 'TE',
          team_id: 'KC',
          projected_points: '20',
          stats: [{ rec_yds: '3000' }],
        },
      ],
      injuries: [],
    });

    expect(result.players).toHaveLength(2);

    const alpha = result.players.find((player) => player.name === 'Alpha WR');
    const beta = result.players.find((player) => player.name === 'Beta TE');

    expect(alpha?.projectedPoints).toBe(22.25);
    expect(beta?.projectedPoints).toBe(14.83);
    expect(alpha?.raw.teamPieScaling).toMatchObject({
      team: 'KC',
      teamPassingBaseline: 4450,
    });
  });

  it('maps rookie flag from merged source records', () => {
    const result = buildFullFantasyProsModel({
      players: [{ id: 301, player_name: 'Rookie Runner', position_id: 'RB', is_rookie: true }],
      rankings: [],
      projections: [{ id: 301, projected_points: '11.2' }],
      injuries: [],
    });

    expect(result.players).toHaveLength(1);
    expect(result.players[0]?.isRookie).toBe(true);
  });

  it('does not mark every player as rookie when experience fields are missing', () => {
    const result = buildFullFantasyProsModel({
      players: [{ id: 401, player_name: 'Veteran By Default', position_id: 'WR' }],
      rankings: [],
      projections: [{ id: 401, projected_points: '9.4' }],
      injuries: [],
    });

    expect(result.players).toHaveLength(1);
    expect(result.players[0]?.isRookie).toBe(false);
  });

  it('derives rookie status from numeric experience when provided', () => {
    const result = buildFullFantasyProsModel({
      players: [
        { id: 402, player_name: 'Year 0 Rookie', position_id: 'RB', years_exp: 0 },
        { id: 403, player_name: 'Year 3 Veteran', position_id: 'WR', years_exp: 3 },
      ],
      rankings: [],
      projections: [
        { id: 402, projected_points: '8.1' },
        { id: 403, projected_points: '11.9' },
      ],
      injuries: [],
    });

    expect(result.players).toHaveLength(2);
    expect(result.players.find((player) => player.id === '402')?.isRookie).toBe(true);
    expect(result.players.find((player) => player.id === '403')?.isRookie).toBe(false);
  });
});

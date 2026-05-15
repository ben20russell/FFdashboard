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
      rankings: [{ id: 7354, player_name: 'Saquon Barkley', rank_ecr: '2', position_id: 'RB' }],
      projections: [{ id: 7354, player_name: 'Saquon Barkley', position_id: 'RB', stats: [{ points: '18.4' }] }],
      injuries: [],
    });

    expect(result.players).toHaveLength(1);
    expect(result.players[0]?.overallRank).toBe(2);
    expect(result.players[0]?.projectedPoints).toBe(18.4);
    expect(result.players[0]?.position).toBe('RB');
  });
});

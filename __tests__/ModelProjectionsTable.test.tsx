import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ModelProjectionsTable } from '@/components/ModelProjectionsTable';

const players = [
  {
    id: '1',
    name: 'Player A',
    position: 'QB',
    projectedPoints: 20,
    customValueScore: 80,
    overallRank: 12,
    injuryStatus: null,
  },
  {
    id: '2',
    name: 'Player B',
    position: 'RB',
    projectedPoints: 18,
    customValueScore: 90,
    overallRank: 6,
    injuryStatus: 'Questionable',
  },
];

describe('ModelProjectionsTable', () => {
  it('renders projection rows', () => {
    render(<ModelProjectionsTable players={players} />);

    expect(screen.getByTestId('projection-row-1')).toBeInTheDocument();
    expect(screen.getByText('Player A')).toBeInTheDocument();
    expect(screen.getByText('Player B')).toBeInTheDocument();
    expect(screen.getByText('Questionable')).toBeInTheDocument();
  });

  it('sorts players by custom value score in descending order', () => {
    render(<ModelProjectionsTable players={players} />);

    const rows = screen.getAllByTestId(/projection-row-/);
    expect(rows[0]).toHaveTextContent('Player B');
    expect(rows[1]).toHaveTextContent('Player A');
  });

  it('renders an empty state when no players are provided', () => {
    render(<ModelProjectionsTable players={[]} />);

    expect(screen.getByTestId('projection-empty-state')).toBeInTheDocument();
  });
});

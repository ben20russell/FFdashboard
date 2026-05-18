import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import Page from '@/app/page';

vi.mock('@/lib/fantasypros', () => ({
  getFantasyProsPlayers: vi.fn().mockResolvedValue({
    players: [],
    rawPayload: {},
    errorMessage: null,
  }),
}));

describe('Page header', () => {
  it('renders the football logo and dashboard title', async () => {
    const ui = await Page();
    render(ui);

    expect(screen.getByTestId('dashboard-logo')).toBeInTheDocument();
    expect(screen.getByAltText('Football logo')).toBeInTheDocument();
    expect(screen.getByText('NFL Fantasy Intelligence')).toBeInTheDocument();
  });
});

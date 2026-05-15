import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StatCard } from '@/components/StatCard';

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Model Status" value="Active" testId="status-card" />);

    expect(screen.getByTestId('status-card')).toBeInTheDocument();
    expect(screen.getByText('Model Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { RawApiOutput } from '@/components/RawApiOutput';

describe('RawApiOutput', () => {
  it('renders JSON payload inside a pre block', () => {
    render(<RawApiOutput payload={{ hello: 'world' }} />);

    expect(screen.getByTestId('raw-api-output')).toBeInTheDocument();
    expect(screen.getByText(/"hello": "world"/)).toBeInTheDocument();
  });
});

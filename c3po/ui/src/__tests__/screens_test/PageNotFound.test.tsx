import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PageNotFound from '../../../src/screens/PageNotFound';

describe('PageNotFound', () => {
  it('should render the page not found message', () => {
    render(
      <MemoryRouter>
        <PageNotFound />
      </MemoryRouter>
    );

    expect(screen.getByText('PageNotFound')).toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Layout from '../../../screens/ConversationalBot/Layout';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

describe('Layout', () => {
  it('should render the layout container', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    expect(container.querySelector('.containers')).toBeInTheDocument();
  });

  it('should render child content via Outlet', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>Child Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });
});

import { vi } from 'vitest';

vi.mock('../ThemeV2', () => ({
  getTheme: vi.fn(() => ({})),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet-content" />,
  };
});

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function renderWithOutlet() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<div data-testid="outlet-content" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it('renders Header and Outlet', () => {
    renderWithOutlet();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
  });

  it('uses light mode by default if localStorage is empty', () => {
    renderWithOutlet();
    expect(screen.getByTestId('header').getAttribute('data-mode')).toBe('light');
  });

  it('uses dark mode if localStorage is set', () => {
    localStorage.setItem('themeMode', 'dark');
    renderWithOutlet();
    expect(screen.getByTestId('header').getAttribute('data-mode')).toBe('dark');
  });

  // it('toggleTheme switches mode and updates localStorage', () => {
  //   renderWithOutlet();
  //   const header = screen.getByTestId('header');
  //   const toggle = screen.getByTestId('theme-toggle');

  //   expect(header.getAttribute('data-mode')).toBe('light');

  //   fireEvent.click(toggle);
  //   expect(header.getAttribute('data-mode')).toBe('dark');
  //   expect(localStorage.getItem('themeMode')).toBe('dark');

  //   fireEvent.click(toggle);
  //   expect(header.getAttribute('data-mode')).toBe('light');
  //   expect(localStorage.getItem('themeMode')).toBe('light');
  // });
});

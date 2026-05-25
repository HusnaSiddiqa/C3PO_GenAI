import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from '../../../../../../screens/ConversationalBot/conversation/components/Header/Header';
import { ThemeProvider } from '@mui/material/styles';
import { getTheme } from '../../../../../../ThemeV2';
import { MemoryRouter } from 'react-router-dom';
import { UserContext } from '../../../../../../contexts/UserContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' }),
  };
});

vi.mock(
  '../../../../../../screens/ConversationalBot/conversation/components/Header/UserMenu',
  () => ({
    __esModule: true,
    UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
  })
);

const theme = getTheme('light');

const renderWithProviders = (
  ui: React.ReactElement,
  userRole: 'user' | 'admin' = 'user',
  authEnabled = 'true'
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  localStorage.setItem('authEnabled', authEnabled);
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <UserContext.Provider
          value={{
            user: { userId: 'test', userName: 'Test', userRole },
            setUser: vi.fn(),
          }}
        >
          <MemoryRouter>{ui}</MemoryRouter>
        </UserContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Header', () => {
  it('should render the header with logos and navigation', () => {
    renderWithProviders(<Header toggleTheme={vi.fn()} mode="light" />);
    expect(screen.getByAltText('C3PO Logo')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('should show Settings button for admin user when auth is enabled', () => {
    renderWithProviders(<Header toggleTheme={vi.fn()} mode="light" />, 'admin');
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should not show Settings button for non-admin user when auth is enabled', () => {
    renderWithProviders(<Header toggleTheme={vi.fn()} mode="light" />, 'user');
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should show Settings button when auth is disabled', () => {
    renderWithProviders(
      <Header toggleTheme={vi.fn()} mode="light" />,
      'user',
      'false'
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  // it('should call toggleTheme when theme switch button is clicked', () => {
  //   const toggleTheme = vi.fn();
  //   renderWithProviders(<Header toggleTheme={toggleTheme} mode="light" />);
  //   fireEvent.click(screen.getByTestId('theme-switch'));
  //   expect(toggleTheme).toHaveBeenCalled();
  // });

  it('should navigate when a nav item is clicked', () => {
    renderWithProviders(
      <Header toggleTheme={vi.fn()} mode="light" />,
      'admin'
    );
    fireEvent.click(screen.getByText('Settings'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });

  it('should navigate to / when Chat is clicked', () => {
    renderWithProviders(<Header toggleTheme={vi.fn()} mode="light" />);
    fireEvent.click(screen.getByText('Chat'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});


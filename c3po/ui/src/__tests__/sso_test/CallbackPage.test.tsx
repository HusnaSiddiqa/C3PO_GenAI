import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useTheme: () => ({
      palette: {
        contrast: {
          grayscale: {
            level0: '#fff',
            level10: '#eee',
            level50: '#ccc',
            level100: '#000',
          },
          status: {
            green10: '#e0ffe0',
            green100: '#00ff00',
            redOff10: '#ffe0e0',
            redOff100: '#ff0000',
          },
          main: {
            main10: '#e0e0ff',
            main100: '#0000ff',
          },
        },
      },
    }),
  };
});
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CallbackPage from '../../sso/CallbackPage';
import { UserContext } from '../../contexts/UserContext';

// Mock dependencies
vi.mock('../../sso/decodeToken', () => ({
  decodeToken: vi.fn().mockReturnValue({
    sub: 'test-user',
    userinfo: { name: 'Test User' },
    groups: [],
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSetUser = vi.fn();

const renderCallbackPage = (search: string) => {
  return render(
    <UserContext.Provider value={{ user: null, setUser: mockSetUser }}>
      <MemoryRouter initialEntries={[`/callback${search}`]}>
        <Routes>
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  );
};

describe('CallbackPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSetUser.mockClear();
    localStorage.clear();
  });

  it('should show loading state initially', () => {
    renderCallbackPage('');
    expect(screen.getByText('Authentication in Progress')).toBeInTheDocument();
    expect(screen.getByText('🔍 Checking authentication parameters...')).toBeInTheDocument();
  });

  it('should handle token from search params and navigate to home', async () => {
    const token = 'test-token';
    renderCallbackPage(`?token=${token}`);

    await waitFor(() => {
      expect(localStorage.getItem('authToken')).toBe(token);
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith({
        userId: 'test-user',
        userName: 'Test User',
        userRole: 'user',
      });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should handle error from search params', async () => {
    renderCallbackPage('?error=access_denied&error_description=Forbidden');
    
    await waitFor(() => {
      expect(screen.getByText('Authentication Error')).toBeInTheDocument();
      expect(screen.getByText('Authentication failed: Forbidden')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should navigate to login if no token or error', async () => {
    renderCallbackPage('');
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    }, { timeout: 5000 });
  });
});
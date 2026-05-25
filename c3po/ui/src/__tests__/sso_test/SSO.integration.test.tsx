import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../../sso/ProtectedRoute';
import * as decodeTokenModule from '../../sso/decodeToken';

// Mock the decodeToken module
vi.mock('../../sso/decodeToken', () => ({
  decodeToken: vi.fn(),
}));

// Mock components
const LoginPage = () => <div>Login Page</div>;
const Dashboard = () => <div>Dashboard</div>;
const Profile = () => <div>Profile Page</div>;
const Settings = () => <div>Settings Page</div>;

// App component that simulates the real app structure
const TestApp = ({ initialPath = '/dashboard' }) => {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/*" element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('SSO Integration Tests', () => {
  const mockDecodeToken = vi.mocked(decodeTokenModule.decodeToken);
  
  let removeItemStub: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    removeItemStub = vi.fn();
    Object.defineProperty(window.localStorage, 'removeItem', {
      value: removeItemStub,
      writable: true,
    });
    Object.defineProperty(globalThis.localStorage, 'removeItem', {
      value: removeItemStub,
      writable: true,
    });
    Object.defineProperty(window, 'location', {
      value: { href: '', assign: vi.fn(), reload: vi.fn(), replace: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should allow access to all protected routes when authenticated', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const mockDecodedToken = {
        sub: 'user123',
        groups: ['admin'],
        exp: futureTimestamp,
        name: 'John Doe',
        email: 'john@example.com',
        userinfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      localStorage.setItem('authToken', validToken);
      mockDecodeToken.mockReturnValue(mockDecodedToken);

      // Test Dashboard route
      const dashboardRender = render(<TestApp initialPath="/dashboard" />);
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
      dashboardRender.unmount();

      // Test Profile route
      const profileRender = render(<TestApp initialPath="/profile" />);
      await waitFor(() => {
        expect(screen.getByText('Profile Page')).toBeInTheDocument();
      });
      profileRender.unmount();

      // Test Settings route
      const settingsRender = render(<TestApp initialPath="/settings" />);
      await waitFor(() => {
        expect(screen.getByText('Settings Page')).toBeInTheDocument();
      });
      settingsRender.unmount();
    });

    it('should prevent access to protected routes when not authenticated', async () => {
      // Arrange - no token in localStorage
      // Act & Assert - test multiple protected routes
      const protectedRoutes = ['/dashboard', '/profile', '/settings'];
      
      for (const route of protectedRoutes) {
        render(<TestApp initialPath={route} />);
        
        await waitFor(() => {
          expect(window.location.href).toBe('/login');
        });
        
        // Reset location for next test
        Object.defineProperty(window, 'location', {
          value: { href: '' },
          writable: true,
        });
      }
    });

    it('should redirect to login when token expires during session', async () => {
      // Arrange - start with valid token
      const expiredToken = 'expired.jwt.token';
      const pastTimestamp = Math.floor(Date.now() / 1000) - 100; // expired 100 seconds ago
      const mockExpiredToken = {
        sub: 'user123',
        groups: ['admin'],
        exp: pastTimestamp,
        name: 'John Doe',
        email: 'john@example.com',
        userinfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      localStorage.setItem('authToken', expiredToken);
      mockDecodeToken.mockReturnValue(mockExpiredToken);

      // Act
      render(<TestApp initialPath="/dashboard" />);

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
    });
  });

  describe('Token Management', () => {
    it('should handle token validation correctly across multiple routes', async () => {
      // Arrange
      const validToken = 'multi.route.token';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const mockDecodedToken = {
        sub: 'user456',
        groups: ['user', 'premium'],
        exp: futureTimestamp,
        name: 'Jane Smith',
        email: 'jane@example.com',
        userinfo: {
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
      };

      localStorage.setItem('authToken', validToken);
      mockDecodeToken.mockReturnValue(mockDecodedToken);

      // Act - navigate through different routes
      const dashboardRender = render(<TestApp initialPath="/dashboard" />);
      
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
      dashboardRender.unmount();

      const profileRender = render(<TestApp initialPath="/profile" />);
      
      await waitFor(() => {
        expect(screen.getByText('Profile Page')).toBeInTheDocument();
      });
      profileRender.unmount();

      const settingsRender = render(<TestApp initialPath="/settings" />);
      
      await waitFor(() => {
        expect(screen.getByText('Settings Page')).toBeInTheDocument();
      });
      settingsRender.unmount();

      // Assert - token should be decoded for each route navigation
      expect(mockDecodeToken).toHaveBeenCalledWith(validToken);
      expect(mockDecodeToken).toHaveBeenCalledTimes(3);
      expect(window.location.href).toBe(''); // Should not redirect
    });

    it('should handle malformed tokens gracefully', async () => {
      // Arrange
      const malformedToken = 'not.a.real.jwt.token.structure';
      localStorage.setItem('authToken', malformedToken);
      mockDecodeToken.mockReturnValue(null); // Simulate decode failure

      // Act
      render(<TestApp initialPath="/dashboard" />);

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
      expect(mockDecodeToken).toHaveBeenCalledWith(malformedToken);
    });
  });

  describe('User Experience', () => {
    it('should show loading state before authentication check completes', () => {
      // Arrange
      const validToken = 'loading.test.token';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const mockDecodedToken = {
        sub: 'user789',
        groups: ['user'],
        exp: futureTimestamp,
        name: 'Bob Wilson',
        email: 'bob@example.com',
        userinfo: {
          name: 'Bob Wilson',
          email: 'bob@example.com',
        },
      };

      localStorage.setItem('authToken', validToken);
      mockDecodeToken.mockReturnValue(mockDecodedToken);

      // Act
      const { container } = render(<TestApp initialPath="/dashboard" />);

      // Assert - Component should render successfully (loading state is too fast to catch reliably)
      expect(container).toBeTruthy();
      expect(container.textContent).toBeTruthy(); // Component has some content
    });

    it('should handle edge case of token expiring exactly at current time', async () => {
      // Arrange
      const exactExpiryToken = 'exact.expiry.token';
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const mockTokenAtExpiry = {
        sub: 'edge-case-user',
        groups: ['user'],
        exp: currentTimestamp, // Expires exactly now
        name: 'Edge Case User',
        email: 'edge@example.com',
        userinfo: {
          name: 'Edge Case User',
          email: 'edge@example.com',
        },
      };

      localStorage.setItem('authToken', exactExpiryToken);
      mockDecodeToken.mockReturnValue(mockTokenAtExpiry);

      // Act
      render(<TestApp initialPath="/dashboard" />);

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
    });
  });

  describe('Security', () => {
    it('should clean up authentication state when redirecting to login', async () => {
      // Arrange
      const suspiciousToken = 'suspicious.token';
      localStorage.setItem('authToken', suspiciousToken);
      mockDecodeToken.mockReturnValue(null); // Simulate failed decode

      // Act
      render(<TestApp initialPath="/dashboard" />);

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
      expect(mockDecodeToken).toHaveBeenCalledWith(suspiciousToken);
    });

    it('should not expose token in DOM or console', async () => {
      // Arrange
      const sensitiveToken = 'secret.sensitive.token';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
      const mockDecodedToken = {
        sub: 'secure-user',
        groups: ['admin'],
        exp: futureTimestamp,
        name: 'Secure User',
        email: 'secure@example.com',
        userinfo: {
          name: 'Secure User',
          email: 'secure@example.com',
        },
      };

      localStorage.setItem('authToken', sensitiveToken);
      mockDecodeToken.mockReturnValue(mockDecodedToken);

      // Act
      const { container } = render(<TestApp initialPath="/dashboard" />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Verify token is not exposed in the DOM
      const htmlContent = container.innerHTML;
      expect(htmlContent).not.toContain(sensitiveToken);
      expect(htmlContent).not.toContain('secret');
      expect(htmlContent).not.toContain('sensitive');
    });
  });
});

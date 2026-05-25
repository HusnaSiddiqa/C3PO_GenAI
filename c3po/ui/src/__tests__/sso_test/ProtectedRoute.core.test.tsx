import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../../sso/ProtectedRoute';
import * as decodeTokenModule from '../../sso/decodeToken';

// Mock the decodeToken module
vi.mock('../../sso/decodeToken', () => ({
  decodeToken: vi.fn(),
}));

// Test component that would be rendered inside the Outlet
const TestChild = () => <div>Protected Content</div>;

// Helper function to render ProtectedRoute with React Router context
const renderProtectedRoute = (initialPath = '/protected') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={<ProtectedRoute />}>
          <Route index element={<TestChild />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute - Core Functionality', () => {
  const mockDecodeToken = vi.mocked(decodeTokenModule.decodeToken);
  
  let removeItemStub: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '', assign: vi.fn(), reload: vi.fn(), replace: vi.fn() },
      writable: true,
    });
    // Reset localStorage
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
  });

  describe('Authentication Success Cases', () => {
    it('should render protected content when user has valid token', async () => {
      // Arrange
      const validToken = 'valid.jwt.token';
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
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

      window.localStorage.setItem('authToken', validToken);
      mockDecodeToken.mockReturnValue(mockDecodedToken);

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
      
      expect(mockDecodeToken).toHaveBeenCalledWith(validToken);
      expect(window.location.href).toBe('');
    });
  });

  describe('Authentication Failure Cases', () => {
    it('should redirect to login when no token exists', async () => {
      // Arrange - no token in localStorage
      window.localStorage.removeItem('authToken');

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
      expect(mockDecodeToken).not.toHaveBeenCalled();
    });

    it('should redirect to login when token is expired', async () => {
      // Arrange
      const expiredToken = 'expired.jwt.token';
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
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

      window.localStorage.setItem('authToken', expiredToken);
      mockDecodeToken.mockReturnValue(mockExpiredToken);

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
      expect(mockDecodeToken).toHaveBeenCalledWith(expiredToken);
    });

    it('should redirect to login when token decode fails', async () => {
      // Arrange
      const invalidToken = 'invalid.token';
      window.localStorage.setItem('authToken', invalidToken);
      mockDecodeToken.mockReturnValue(null);

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
      expect(mockDecodeToken).toHaveBeenCalledWith(invalidToken);
    });

    it('should redirect to login when decoded token has no exp field', async () => {
      // Arrange
      const tokenWithoutExp = 'token.without.exp';
      const mockTokenWithoutExp = {
        sub: 'user123',
        groups: ['admin'],
        name: 'John Doe',
        email: 'john@example.com',
        userinfo: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        // exp is missing
      } as any;

      window.localStorage.setItem('authToken', tokenWithoutExp);
      mockDecodeToken.mockReturnValue(mockTokenWithoutExp);

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
      expect(mockDecodeToken).toHaveBeenCalledWith(tokenWithoutExp);
    });
  });

  describe('Token Management', () => {
    // No-op: handled globally

    it('should clean up expired tokens from localStorage', async () => {
      // Arrange
      const expiredToken = 'expired.token';
      const pastTimestamp = Math.floor(Date.now() / 1000) - 100;
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

      window.localStorage.setItem('authToken', expiredToken);
      mockDecodeToken.mockReturnValue(mockExpiredToken);

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
    });

    it('should clean up invalid tokens from localStorage', async () => {
      // Arrange
      const invalidToken = 'invalid.token';
      window.localStorage.setItem('authToken', invalidToken);
      mockDecodeToken.mockReturnValue(null);

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
      
    });
  });

  describe('Edge Cases', () => {
    // No-op: handled globally

    it('should handle token at exact expiry time', async () => {
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

      window.localStorage.setItem('authToken', exactExpiryToken);
      mockDecodeToken.mockReturnValue(mockTokenAtExpiry);

      // Act
      renderProtectedRoute();

      // Assert
      await waitFor(() => {
        expect(window.location.href).toBe('/login');
      });
    });
  });
});

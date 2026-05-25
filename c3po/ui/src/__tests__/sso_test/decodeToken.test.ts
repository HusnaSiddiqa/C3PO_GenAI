import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeToken, type DecodedToken } from '../../sso/decodeToken';
import { jwtDecode } from 'jwt-decode';

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(),
}));

describe('decodeToken', () => {
  const mockJwtDecode = vi.mocked(jwtDecode);

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful token decoding', () => {
    it('should return decoded token when jwt-decode succeeds', () => {
      // Arrange
      const mockToken = 'valid.jwt.token';
      const mockDecodedToken: DecodedToken = {
        sub: 'user123',
        groups: ['admin', 'user'],
        exp: 1234567890,
        name: 'John Doe',
        email: 'john.doe@example.com',
        userinfo: {
          name: 'John Doe',
          email: 'john.doe@example.com',
        },
      };

      mockJwtDecode.mockReturnValue(mockDecodedToken);

      // Act
      const result = decodeToken(mockToken);

      // Assert
      expect(result).toEqual(mockDecodedToken);
      expect(mockJwtDecode).toHaveBeenCalledWith(mockToken);
      expect(mockJwtDecode).toHaveBeenCalledTimes(1);
    });

    it('should return decoded token with minimal required fields', () => {
      // Arrange
      const mockToken = 'minimal.jwt.token';
      const mockDecodedToken: DecodedToken = {
        sub: 'user456',
        groups: [],
        exp: 9876543210,
        name: 'Jane Smith',
        email: 'jane@example.com',
        userinfo: {
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
      };

      mockJwtDecode.mockReturnValue(mockDecodedToken);

      // Act
      const result = decodeToken(mockToken);

      // Assert
      expect(result).toEqual(mockDecodedToken);
      expect(result?.sub).toBe('user456');
      expect(result?.groups).toEqual([]);
      expect(result?.exp).toBe(9876543210);
      expect(result?.name).toBe('Jane Smith');
      expect(result?.email).toBe('jane@example.com');
      expect(result?.userinfo).toEqual({
        name: 'Jane Smith',
        email: 'jane@example.com',
      });
    });

    it('should return decoded token with multiple groups', () => {
      // Arrange
      const mockToken = 'multi.group.token';
      const mockDecodedToken: DecodedToken = {
        sub: 'user789',
        groups: ['admin', 'moderator', 'user', 'developer'],
        exp: 1111111111,
        name: 'Bob Wilson',
        email: 'bob@example.com',
        userinfo: {
          name: 'Bob Wilson',
          email: 'bob@example.com',
        },
      };

      mockJwtDecode.mockReturnValue(mockDecodedToken);

      // Act
      const result = decodeToken(mockToken);

      // Assert
      expect(result).toEqual(mockDecodedToken);
      expect(result?.groups).toHaveLength(4);
      expect(result?.groups).toContain('admin');
      expect(result?.groups).toContain('developer');
    });
  });

  describe('failed token decoding', () => {
    it('should return null when jwt-decode throws an error', () => {
      // Arrange
      const invalidToken = 'invalid.token';
      const mockError = new Error('Invalid token format');
      mockJwtDecode.mockImplementation(() => {
        throw mockError;
      });

      // Act
      const result = decodeToken(invalidToken);

      // Assert
      expect(result).toBeNull();
      expect(mockJwtDecode).toHaveBeenCalledWith(invalidToken);
      expect(console.error).toHaveBeenCalledWith('Token decode failed', mockError);
    });

    it('should return null when jwt-decode throws a syntax error', () => {
      // Arrange
      const malformedToken = 'not.a.jwt.token';
      const syntaxError = new SyntaxError('Unexpected token');
      mockJwtDecode.mockImplementation(() => {
        throw syntaxError;
      });

      // Act
      const result = decodeToken(malformedToken);

      // Assert
      expect(result).toBeNull();
      expect(mockJwtDecode).toHaveBeenCalledWith(malformedToken);
      expect(console.error).toHaveBeenCalledWith('Token decode failed', syntaxError);
    });

    it('should return null for empty string token', () => {
      // Arrange
      const emptyToken = '';
      const mockError = new Error('Token is empty');
      mockJwtDecode.mockImplementation(() => {
        throw mockError;
      });

      // Act
      const result = decodeToken(emptyToken);

      // Assert
      expect(result).toBeNull();
      expect(mockJwtDecode).toHaveBeenCalledWith(emptyToken);
      expect(console.error).toHaveBeenCalledWith('Token decode failed', mockError);
    });

    it('should return null when jwt-decode throws unknown error type', () => {
      // Arrange
      const unknownToken = 'unknown.error.token';
      const unknownError = 'String error instead of Error object';
      mockJwtDecode.mockImplementation(() => {
        throw unknownError;
      });

      // Act
      const result = decodeToken(unknownToken);

      // Assert
      expect(result).toBeNull();
      expect(mockJwtDecode).toHaveBeenCalledWith(unknownToken);
      expect(console.error).toHaveBeenCalledWith('Token decode failed', unknownError);
    });
  });

  describe('edge cases', () => {
    it('should handle very long tokens', () => {
      // Arrange
      const longToken = 'a'.repeat(10000); // Very long token
      const mockDecodedToken: DecodedToken = {
        sub: 'long-token-user',
        groups: ['user'],
        exp: 2222222222,
        name: 'Long Token User',
        email: 'long@example.com',
        userinfo: {
          name: 'Long Token User',
          email: 'long@example.com',
        },
      };

      mockJwtDecode.mockReturnValue(mockDecodedToken);

      // Act
      const result = decodeToken(longToken);

      // Assert
      expect(result).toEqual(mockDecodedToken);
      expect(mockJwtDecode).toHaveBeenCalledWith(longToken);
    });

    it('should handle tokens with special characters in userinfo', () => {
      // Arrange
      const specialToken = 'special.chars.token';
      const mockDecodedToken: DecodedToken = {
        sub: 'special-user',
        groups: ['тест', 'ñoño', '测试'],
        exp: 3333333333,
        name: 'José María Ñoño',
        email: 'josé@tëst.com',
        userinfo: {
          name: 'José María Ñoño',
          email: 'josé@tëst.com',
        },
      };

      mockJwtDecode.mockReturnValue(mockDecodedToken);

      // Act
      const result = decodeToken(specialToken);

      // Assert
      expect(result).toEqual(mockDecodedToken);
      expect(result?.name).toBe('José María Ñoño');
      expect(result?.email).toBe('josé@tëst.com');
      expect(result?.groups).toContain('тест');
      expect(result?.groups).toContain('ñoño');
      expect(result?.groups).toContain('测试');
    });
  });
});

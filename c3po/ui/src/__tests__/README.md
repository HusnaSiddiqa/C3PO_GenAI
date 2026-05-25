# SSO Testing Documentation

This directory contains comprehensive unit tests for the SSO (Single Sign-On) functionality using React Testing Library (RTL) and Vitest.

## Test Structure

```
src/__tests__/
├── setup.ts                    # Global test setup and mocks
└── sso_test/
    ├── ProtectedRoute.test.tsx      # Comprehensive ProtectedRoute tests
    ├── ProtectedRoute.core.test.tsx # Core functionality tests (simplified)
    ├── decodeToken.test.ts          # JWT token decoding utility tests
    └── SSO.integration.test.tsx     # Integration tests for SSO flow
```

## What's Being Tested

### ProtectedRoute Component
- **Authentication Success**: Valid tokens allow access to protected content
- **Authentication Failure**: Expired, invalid, or missing tokens redirect to login
- **Token Management**: Automatic cleanup of invalid tokens from localStorage
- **Navigation Behavior**: Re-authentication on route changes
- **Edge Cases**: Boundary conditions like exact expiry times
- **Security**: Token cleanup and no exposure of sensitive data

### DecodeToken Utility
- **Successful Decoding**: Valid JWT tokens are properly decoded
- **Error Handling**: Graceful handling of malformed or invalid tokens
- **Edge Cases**: Very long tokens, special characters, unknown error types
- **Type Safety**: Proper TypeScript type handling

### Integration Tests
- **End-to-End Authentication Flow**: Complete user journey from login to protected routes
- **Multi-Route Navigation**: Authentication persistence across different routes
- **User Experience**: Loading states and smooth transitions
- **Security**: Token management and cleanup across the application

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)
```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/'],
    },
  },
});
```

### Test Setup (`setup.ts`)
- **Global Mocks**: localStorage, window.location, and other browser APIs
- **Testing Library Extensions**: Custom matchers and utilities
- **Mock Implementations**: Realistic localStorage behavior for testing

## Running Tests

### Available Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode (interactive)
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage
```

### Example Test Output

```
✓ ProtectedRoute - Core Functionality (8 tests)
  ✓ Authentication Success Cases (1)
    ✓ should render protected content when user has valid token
  ✓ Authentication Failure Cases (4)
    ✓ should redirect to login when no token exists
    ✓ should redirect to login when token is expired
    ✓ should redirect to login when token decode fails
    ✓ should redirect to login when decoded token has no exp field
  ✓ Token Management (2)
    ✓ should clean up expired tokens from localStorage
    ✓ should clean up invalid tokens from localStorage
  ✓ Edge Cases (1)
    ✓ should handle token at exact expiry time
```

## Test Patterns and Best Practices

### 1. Arrange-Act-Assert Pattern
```typescript
it('should redirect to login when token is expired', async () => {
  // Arrange
  const expiredToken = 'expired.jwt.token';
  const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
  
  // Act
  renderProtectedRoute();
  
  // Assert
  await waitFor(() => {
    expect(window.location.href).toBe('/login');
  });
});
```

### 2. Proper Mocking
```typescript
// Mock external dependencies
vi.mock('../../sso/decodeToken', () => ({
  decodeToken: vi.fn(),
}));

// Use typed mocks
const mockDecodeToken = vi.mocked(decodeTokenModule.decodeToken);
```

### 3. Async Testing
```typescript
// Always use waitFor for async assertions
await waitFor(() => {
  expect(screen.getByText('Protected Content')).toBeInTheDocument();
});
```

### 4. Test Isolation
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  // Reset any other global state
});
```

## Debugging Tests

### Common Issues and Solutions

1. **localStorage not working**: Ensure setup.ts properly mocks localStorage
2. **Timing issues**: Use `waitFor` for async operations
3. **Component not rendering**: Check React Router setup in test helpers
4. **Mocks not working**: Verify mock placement and imports

### Debug Tools
```typescript
// Debug component output
screen.debug();

// Check what's in the DOM
console.log(screen.getByTestId('component').innerHTML);

// Check mock calls
console.log(mockDecodeToken.mock.calls);
```

## Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## Continuous Integration

These tests are designed to run in CI environments with:
- No external dependencies
- Deterministic behavior
- Fast execution
- Clear failure messages

## Adding New Tests

When adding new SSO functionality:

1. Add unit tests to the appropriate test file
2. Update integration tests if needed
3. Ensure proper mocking of external dependencies
4. Follow existing patterns and naming conventions
5. Add documentation for complex test scenarios

## Dependencies

### Testing Framework
- **Vitest**: Modern, fast test runner
- **jsdom**: DOM simulation for browser APIs

### Testing Utilities
- **@testing-library/react**: Component testing utilities
- **@testing-library/jest-dom**: Custom DOM matchers
- **@testing-library/user-event**: User interaction simulation

### Mocking
- **Vitest vi**: Built-in mocking utilities
- Custom localStorage and location mocks

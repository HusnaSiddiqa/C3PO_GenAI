import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import { ErrorFallback } from '../../../../screens/Setting/components/ErrorBoundry';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
let mockLocation = { pathname: '/' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

vi.mock('../../../ThemeV2', () => ({
  getTheme: vi.fn(() => ({
    palette: {
      contrast: {
        grayscale: {
          level0: '#ffffff',
          level5: '#f5f5f5',
          level10: '#e0e0e0',
          level50: '#777777',
          level75: '#444444',
        },
        main: {
          main10: '#e3f2fd',
          main100: '#1976d2',
        },
      },
    },
    spacing: vi.fn((factor) => `${factor * 8}px`),
  })),
}));

vi.mock('@phosphor-icons/react', () => ({
  ChatsIcon: vi.fn(({ size }) => <div data-testid="chats-icon" data-size={size}>ChatsIcon</div>),
  LinkBreakIcon: vi.fn(({ size, style }) => (
    <div data-testid="link-break-icon" data-size={size} style={style}>LinkBreakIcon</div>
  )),
  UserCircleIcon: vi.fn(({ size }) => <div data-testid="user-circle-icon" data-size={size}>UserCircleIcon</div>),
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

const mockNavigate = vi.fn();

const renderWithRouter = (component: React.ReactElement, initialPath = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      {component}
    </MemoryRouter>
  );
};

describe('ErrorFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  const mockError = {
    name: 'Test Error',
    message: 'Something went wrong',
    stack: 'Error stack trace',
  };

  it('renders the basic error UI structure', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('Technical issue encountred')).toBeInTheDocument();
    expect(screen.getByText(/we're facing a temporary issue/)).toBeInTheDocument();
    expect(screen.getByTestId('link-break-icon')).toBeInTheDocument();
    expect(screen.getByTestId('user-circle-icon')).toBeInTheDocument();
  });

  it('displays error message information', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('"Something went wrong"')).toBeInTheDocument();
  });

  it('renders logos correctly', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    const gileadLogo = screen.getByAltText('Gilead Logo');
    const c3poLogo = screen.getByAltText('C3PO Logo');

    expect(gileadLogo).toBeInTheDocument();
    expect(gileadLogo).toHaveAttribute('src', 'gilead-logo.svg');
    expect(c3poLogo).toBeInTheDocument();
    expect(c3poLogo).toHaveAttribute('src', 'c3po.svg');
  });

  it('renders navigation with Chat button', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    const chatButton = screen.getByRole('button', { name: /chat/i });
    expect(chatButton).toBeInTheDocument();
    expect(screen.getByTestId('chats-icon')).toBeInTheDocument();
  });

  it('displays user information', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByTestId('user-circle-icon')).toBeInTheDocument();
  });

  it('navigates to home when Chat button is clicked with no recent conversation', () => {
    mockSessionStorage.getItem.mockReturnValue('/');
    
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    const chatButton = screen.getByRole('button', { name: /chat/i });
    fireEvent.click(chatButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to recent conversation when Chat button is clicked', () => {
    mockSessionStorage.getItem.mockReturnValue('conversation-123');
    
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    const chatButton = screen.getByRole('button', { name: /chat/i });
    fireEvent.click(chatButton);

    expect(mockNavigate).toHaveBeenCalledWith('/conversation-123');
  });

  it('handles null error gracefully', () => {
    renderWithRouter(<ErrorFallback error={null} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('Technical issue encountred')).toBeInTheDocument();
    // Should not crash when error is null
  });

  it('handles undefined error gracefully', () => {
    renderWithRouter(<ErrorFallback error={undefined} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('Technical issue encountred')).toBeInTheDocument();
    // Should not crash when error is undefined
  });

  it('displays different error types correctly', () => {
    const typeError = new TypeError('Type error occurred');
    
    renderWithRouter(<ErrorFallback error={typeError} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('"Type error occurred"')).toBeInTheDocument();
  });

  it('applies correct styling to error icon', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    const linkBreakIcon = screen.getByTestId('link-break-icon');
    expect(linkBreakIcon).toHaveAttribute('data-size', '64');
    expect(linkBreakIcon).toHaveStyle({ alignSelf: 'center', marginTop: '308px' });
  });

  it('shows contact information for assistance', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    expect(screen.getByText(/xyz@gilead.com/)).toBeInTheDocument();
  });

  it('applies theme correctly', () => {
    renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);

    // Verify that theme provider is applied
    expect(screen.getByText('Technical issue encountred')).toBeInTheDocument();
  });

  it('handles Chat button navigation with different sessionStorage values', () => {
    // Test with null sessionStorage
    mockSessionStorage.getItem.mockReturnValue(null);
    const { rerender } = renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);
    
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');

    // Test with empty string
    mockNavigate.mockClear();
    mockSessionStorage.getItem.mockReturnValue('');
    rerender(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);
    
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders error message as JSON string', () => {
    const complexError = {
      name: 'NetworkError',
      message: 'Failed to fetch data',
      code: 500,
    };
    
    renderWithRouter(<ErrorFallback error={complexError} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('"Failed to fetch data"')).toBeInTheDocument();
  });

  it('updates error info when error prop changes', () => {
    const { rerender } = renderWithRouter(<ErrorFallback error={mockError} resetErrorBoundary={() => {}} />);
    
    expect(screen.getByText('"Something went wrong"')).toBeInTheDocument();

    const newError = { name: 'New Error', message: 'Different error message' };
    rerender(<ErrorFallback error={newError} resetErrorBoundary={() => {}} />);
    
    expect(screen.getByText('"Different error message"')).toBeInTheDocument();
  });

  it('handles errors without message property', () => {
    const errorWithoutMessage = { name: 'Error', stack: 'stack trace' };
    
    renderWithRouter(<ErrorFallback error={errorWithoutMessage} resetErrorBoundary={() => {}} />);

    expect(screen.getByText('Technical issue encountred')).toBeInTheDocument();
    // Should not crash when error has no message
  });
});
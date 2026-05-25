import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StreamingText } from '../../components/StreamingText/StreamingText';

// Mock MarkdownRenderer to just render children as text
vi.mock('../../components/MarkdownRenderer/MarkdownRenderer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

describe('StreamingText', () => {
  it('renders full content immediately when not streaming', () => {
    render(<StreamingText content="Hello world!" isStreaming={false} />);
    expect(screen.getByText('Hello world!')).toBeInTheDocument();
  });

  it('streams content character by character when streaming', async () => {
    vi.useFakeTimers();
    render(<StreamingText content="Hi!" isStreaming={true} speed={1} />);
    // Fast-forward all timers
    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByText('Hi!')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('calls onComplete after streaming finishes', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<StreamingText content="Done" isStreaming={true} speed={1} onComplete={onComplete} />);
    act(() => {
      vi.runAllTimers();
    });
    expect(onComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

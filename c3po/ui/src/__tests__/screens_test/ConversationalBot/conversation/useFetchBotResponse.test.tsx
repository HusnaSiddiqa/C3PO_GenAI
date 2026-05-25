import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreamBotResponse } from '../../../../screens/ConversationalBot/conversation/ConversationPage/useFetchBotResponse';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the global fetch function
global.fetch = vi.fn();

const createReadableStream = (chunks: string[]) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return stream;
};

const queryClient = new QueryClient();
const wrapper = ({ children }: { children: React.ReactNode }) => {
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useStreamBotResponse', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle successful streaming of messages', async () => {
    const streamChunks = [
      '{"role": "assistant", "message_type": "agent_message", "text": "Hello"}\n',
      '{"role": "assistant", "message_type": "agent_message", "text": " World", "is_final": true}\n',
    ];
    const stream = createReadableStream(streamChunks);
    const response = {
      ok: true,
      body: stream,
    };
    (fetch as any).mockResolvedValue(response);

    const { result } = renderHook(() => useStreamBotResponse(), { wrapper });

    const onStreamingMessage = vi.fn();
    const onStreamFinalMessage = vi.fn();

    await act(async () => {
      result.current.mutate({
        text: 'test',
        conversationId: '123',
        fileId: null,
        onStreamingMessage,
        onStreamFinalMessage,
      });
    });

    expect(onStreamingMessage).toHaveBeenCalledWith({
      role: 'assistant',
      message_type: 'agent_message',
      text: 'Hello',
    });
    expect(onStreamFinalMessage).toHaveBeenCalledWith({
      role: 'assistant',
      message_type: 'agent_message',
      text: ' World',
      is_final: true,
    });
  });

  it('should handle stream error', async () => {
    const response = {
      ok: false,
      statusText: 'Internal Server Error',
    };
    (fetch as any).mockResolvedValue(response);

    const { result } = renderHook(() => useStreamBotResponse(), { wrapper });

    const onStreamError = vi.fn();

    await act(async () => {
      result.current.mutate({
        text: 'test',
        conversationId: '123',
        fileId: null,
        onStreamingMessage: vi.fn(),
        onStreamFinalMessage: vi.fn(),
        onStreamError,
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(onStreamError).toHaveBeenCalled();
    });
  });

  it('should handle stream cancellation', async () => {
    const abortController = new AbortController();
    const signal = abortController.signal;
    (fetch as any).mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const { result } = renderHook(() => useStreamBotResponse(), { wrapper });

    act(() => {
      result.current.mutate({
        text: 'test',
        conversationId: '123',
        fileId: null,
        onStreamingMessage: vi.fn(),
        onStreamFinalMessage: vi.fn(),
      });
    });

    act(() => {
      result.current.cancelStream();
    });

    expect(result.current.isError).toBe(false);
  });
});

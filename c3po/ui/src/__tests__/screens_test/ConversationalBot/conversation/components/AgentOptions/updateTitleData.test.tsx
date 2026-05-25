import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UpdateTitleData } from '../../../../../../screens/ConversationalBot/conversation/components/AgentOptions/updateTitleData';
import * as React from 'react';

describe('UpdateTitleData hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        ({
          ok: true,
          json: async () => ({
            conversation_id: '123',
            title: 'New Title',
            message: 'Title updated',
          }),
        } as Response)
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should call fetch with correct params and succeed', async () => {
    const { result } = renderHook(() => UpdateTitleData(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ conversation_id: '123', title: 'New Title' });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/v2/chat-manager/conversation/title',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: '123', title: 'New Title' }),
        credentials: 'include', // add this if your implementation uses it
      }
    );
    expect(console.log).toHaveBeenCalledWith('Data updated successfully');
  });

  it('should handle fetch error', async () => {
    (global.fetch as any) = vi.fn(() => Promise.resolve({ ok: false }));
    const { result } = renderHook(() => UpdateTitleData(), { wrapper: Wrapper });

    let error: any;
    await act(async () => {
      try {
        await result.current.mutateAsync({ conversation_id: '123', title: 'New Title' });
      } catch (e) {
        error = e;
      }
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Failed to update');
    expect(console.error).toHaveBeenCalledWith('Update failed:', error);
  });
});

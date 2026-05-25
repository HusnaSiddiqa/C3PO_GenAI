import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { deleteConversation, DeleteConversation } from '../../../../../../screens/ConversationalBot/conversation/components/AgentOptions/deleteConversation';
import * as React from 'react';

describe('DeleteConversation hook', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient();
        vi.spyOn(queryClient, 'invalidateQueries');
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: new Headers(),
                redirected: false,
                type: 'basic',
                url: '',
                clone: () => this,
                body: null,
                bodyUsed: false,
                arrayBuffer: async () => new ArrayBuffer(0),
                blob: async () => new Blob(),
                formData: async () => new FormData(),
                json: async () => ({}),
                text: async () => '',
                bytes: async () => new Uint8Array(),
            } as unknown as Response)
        );
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    // Wrapper must be after queryClient is declared
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    it('should call deleteConversation and invalidate chat-history on success', async () => {
        const { result } = renderHook(() => DeleteConversation(), { wrapper: Wrapper });

        await act(async () => {
            await result.current.mutateAsync('456');
        });

        expect(global.fetch).toHaveBeenCalledWith(
            '/v2/chat-manager/conversation/456',
            { method: 'DELETE', credentials: 'include' }
        );
        expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['chat-history'] });
    });

    it('should handle errors from deleteConversation', async () => {
        (global.fetch as any) = vi.fn(() => Promise.resolve({ ok: false }));

        const { result } = renderHook(() => DeleteConversation(), { wrapper: Wrapper });

        let error: any;
        await act(async () => {
            try {
                await result.current.mutateAsync('789');
            } catch (e) {
                error = e;
            }
        });

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Failed to delete conversation');
    });
});